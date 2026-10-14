import type { ReportMetric, ReportRow, ReportVessel } from "@/lib/gfw/schemas";

/**
 * Agregasi murni dari baris report GFW ternormalisasi (PRD §9).
 * Aturan: tanggal tanpa baris = null (bukan nol); bendera kosong = kelompok "tidak diketahui";
 * jumlah ID kapal tidak pernah dijumlah lintas baris untuk membuat jumlah unik.
 */

export type ReportKind = "daily" | "cells" | "vessels";

/** Daftar hari UTC dalam [start, end) — end eksklusif, sesuai perilaku date-range GFW (fixture 11). */
export function daysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t < Date.parse(`${end}T00:00:00Z`); t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

const UNKNOWN_FLAG = "__unknown__";
const flagKey = (flag: string | null) => flag ?? UNKNOWN_FLAG;
export const isUnknownFlag = (key: string) => key === UNKNOWN_FLAG;

function round(value: number, digits = 6): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

// ---------------------------------------------------------------------------
// Tren harian (temporal DAILY, spatial-aggregation=true, group-by FLAG)
// ---------------------------------------------------------------------------

export type DailyPoint = {
  date: string;
  /** null = tidak ada baris untuk hari ini dari provider (bukan nol terverifikasi). */
  value: number | null;
};

export type FlagTotal = { flag: string | null; value: number };

export type DailyResult = {
  kind: "daily";
  metric: ReportMetric;
  series: DailyPoint[];
  /** Jumlah nilai pada hari yang memiliki baris; null bila tidak ada baris sama sekali. */
  total: number | null;
  flagTotals: FlagTotal[];
  daysWithoutRows: string[];
  /** Hari terakhir yang memiliki nilai > 0 dalam hasil. */
  latestObservationDate: string | null;
};

export function aggregateDaily(rows: ReportRow[], metric: ReportMetric, start: string, end: string): DailyResult {
  const byDate = new Map<string, number>();
  const byFlag = new Map<string, number>();
  for (const row of rows) {
    if (row.value === null) continue;
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + row.value);
    byFlag.set(flagKey(row.flag), (byFlag.get(flagKey(row.flag)) ?? 0) + row.value);
  }
  const days = daysInRange(start, end);
  const series = days.map((date) => ({ date, value: byDate.has(date) ? round(byDate.get(date)!) : null }));
  const known = series.filter((p) => p.value !== null);
  const latest = [...series].reverse().find((p) => p.value !== null && p.value > 0);
  return {
    kind: "daily",
    metric,
    series,
    total: known.length ? round(known.reduce((sum, p) => sum + p.value!, 0)) : null,
    flagTotals: [...byFlag.entries()]
      .map(([key, value]) => ({ flag: isUnknownFlag(key) ? null : key, value: round(value) }))
      .sort((a, b) => b.value - a.value),
    daysWithoutRows: series.filter((p) => p.value === null).map((p) => p.date),
    latestObservationDate: latest?.date ?? null,
  };
}

// ---------------------------------------------------------------------------
// Sel grid (temporal ENTIRE, spatial-aggregation=false, resolusi LOW, group-by FLAG)
// ---------------------------------------------------------------------------

export type Cell = {
  lat: number;
  lon: number;
  value: number;
  /** Rincian per bendera: [bendera|null, nilai, jumlah ID kapal pada baris bendera tsb]. */
  byFlag: Array<[string | null, number, number | null]>;
};

export type CellsResult = {
  kind: "cells";
  metric: ReportMetric;
  /** Resolusi LOW teramati 0,1° (fixture 08–10); posisi titik dalam sel belum dipastikan. */
  resolutionDeg: number;
  cells: Cell[];
  cellCount: number;
  total: number;
};

export function aggregateCells(rows: ReportRow[], metric: ReportMetric): CellsResult {
  const cells = new Map<string, Cell>();
  for (const row of rows) {
    if (row.value === null || row.lat === null || row.lon === null) continue;
    const key = `${row.lat},${row.lon}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { lat: row.lat, lon: row.lon, value: 0, byFlag: [] };
      cells.set(key, cell);
    }
    cell.value += row.value;
    cell.byFlag.push([row.flag, round(row.value), row.vesselIdCount]);
  }
  const list = [...cells.values()].map((c) => ({
    ...c,
    value: round(c.value),
    byFlag: c.byFlag.sort((a, b) => b[1] - a[1]),
  }));
  list.sort((a, b) => b.value - a.value);
  return {
    kind: "cells",
    metric,
    resolutionDeg: 0.1,
    cells: list,
    cellCount: list.length,
    total: round(list.reduce((sum, c) => sum + c.value, 0)),
  };
}

// ---------------------------------------------------------------------------
// Kapal (temporal ENTIRE, spatial-aggregation=true, group-by VESSEL_ID)
// ---------------------------------------------------------------------------

export type VesselContribution = ReportVessel & { flag: string | null; value: number };

export type VesselsResult = {
  kind: "vessels";
  metric: ReportMetric;
  /** Cardinality distinct GFW vessel ID pada hasil (PRD §9: uniqueVesselIds). */
  uniqueVesselIds: number;
  total: number;
  /** Baris tanpa vesselId (mis. deteksi SAR tanpa pasangan AIS) dilaporkan terpisah. */
  rowsWithoutVesselId: number;
  valueWithoutVesselId: number;
  /** Maksimum exitTimestamp — "Observasi terakhir dalam hasil". */
  latestObservationAt: string | null;
  /** 100 kontributor teratas menurut nilai metric. */
  topVessels: VesselContribution[];
  /** Rincian seluruh kapal (bukan hanya 100 teratas). Tidak ada pada hasil lama (sebelum 14 Okt 2026). */
  fleet?: FleetBreakdown;
};

/** Satu kelompok: nilai metric + jumlah ID kapal berbeda. Kunci null = tidak diketahui. */
export type GroupTotal = { key: string | null; value: number; vessels: number };

export type FleetBreakdown = {
  byGear: GroupTotal[];
  byVesselType: GroupTotal[];
  byFlag: GroupTotal[];
  /** Sebaran nilai per kapal; batas bawah inklusif, atas eksklusif (null = tak terbatas). */
  histogram: Array<{ lo: number; hi: number | null; vessels: number; value: number }>;
  meanPerVessel: number;
  medianPerVessel: number;
  /** Porsi nilai dari 10 kapal teratas dan dari 10% kapal teratas (0–1). */
  top10Share: number;
  top10PctShare: number;
};

const HOURS_BINS = [0, 1, 5, 10, 24, 72, 168];
const COUNT_BINS = [0, 2, 5, 10, 20, 50];

function groupBy(vessels: VesselContribution[], key: (v: VesselContribution) => string | null): GroupTotal[] {
  const m = new Map<string, GroupTotal>();
  for (const v of vessels) {
    const k = key(v) || null;
    const id = k ?? "__unknown__";
    const g = m.get(id) ?? { key: k, value: 0, vessels: 0 };
    g.value += v.value;
    g.vessels += 1;
    m.set(id, g);
  }
  return [...m.values()].map((g) => ({ ...g, value: round(g.value) })).sort((a, b) => b.value - a.value);
}

export function fleetBreakdown(vessels: VesselContribution[], metric: ReportMetric): FleetBreakdown {
  const sorted = [...vessels].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, v) => s + v.value, 0);
  const edges = metric === "detections" ? COUNT_BINS : HOURS_BINS;
  const histogram = edges.map((lo, i) => ({ lo, hi: edges[i + 1] ?? null, vessels: 0, value: 0 }));
  for (const v of sorted) {
    const bin = histogram.findLast((b) => v.value >= b.lo) ?? histogram[0];
    bin.vessels += 1;
    bin.value += v.value;
  }
  const values = sorted.map((v) => v.value).reverse();
  const mid = Math.floor(values.length / 2);
  const medianValue = values.length === 0 ? 0 : values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  const share = (n: number) => (total > 0 ? sorted.slice(0, n).reduce((s, v) => s + v.value, 0) / total : 0);
  return {
    byGear: groupBy(sorted, (v) => v.geartype),
    byVesselType: groupBy(sorted, (v) => v.vesselType),
    byFlag: groupBy(sorted, (v) => v.flag),
    histogram: histogram.map((b) => ({ ...b, value: round(b.value) })),
    meanPerVessel: sorted.length ? round(total / sorted.length) : 0,
    medianPerVessel: round(medianValue),
    top10Share: round(share(10)),
    top10PctShare: round(share(Math.max(1, Math.ceil(sorted.length * 0.1)))),
  };
}

export function aggregateVessels(rows: ReportRow[], metric: ReportMetric, topN = 100): VesselsResult {
  const byVessel = new Map<string, VesselContribution>();
  let rowsWithoutVesselId = 0;
  let valueWithoutVesselId = 0;
  let latest: string | null = null;
  for (const row of rows) {
    const value = row.value ?? 0;
    if (!row.vessel) {
      rowsWithoutVesselId += 1;
      valueWithoutVesselId += value;
      continue;
    }
    const existing = byVessel.get(row.vessel.vesselId);
    if (existing) existing.value += value;
    else byVessel.set(row.vessel.vesselId, { ...row.vessel, flag: row.flag, value });
    const exit = row.vessel.exitTimestamp;
    if (exit && (!latest || Date.parse(exit) > Date.parse(latest))) latest = exit;
  }
  const vessels = [...byVessel.values()].map((v) => ({ ...v, value: round(v.value) })).sort((a, b) => b.value - a.value);
  return {
    kind: "vessels",
    metric,
    uniqueVesselIds: byVessel.size,
    total: round(vessels.reduce((sum, v) => sum + v.value, 0) + valueWithoutVesselId),
    rowsWithoutVesselId,
    valueWithoutVesselId: round(valueWithoutVesselId),
    latestObservationAt: latest,
    topVessels: vessels.slice(0, topN),
    fleet: fleetBreakdown(vessels, metric),
  };
}

export type ReportPayload = DailyResult | CellsResult | VesselsResult;
