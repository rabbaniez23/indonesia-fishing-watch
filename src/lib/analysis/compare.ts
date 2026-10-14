import { classIndex, quantileBins, type Bins } from "@/lib/map/bins";
import type { Cell } from "./aggregate";
import { addDays, dayDiff, todayUtc, type PeriodFilter } from "./period";

/**
 * Perbandingan dua periode (FR-05). Pure.
 * - Panjang periode sama; periode pembanding tidak boleh tumpang tindih dengan periode aktif.
 * - Kelas warna dihitung dari gabungan nilai KEDUA periode → skala identik (PRD §11.4).
 */

export function comparisonPeriod(active: PeriodFilter, cmpFrom: string | null, now: Date = new Date()): { period: PeriodFilter; error: string | null } {
  const fallback = { ...active, from: addDays(active.from, -active.days), to: addDays(active.from, -1), start: addDays(active.from, -active.days), end: active.from };
  if (!cmpFrom) return { period: fallback, error: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cmpFrom)) return { period: fallback, error: "Tanggal periode pembanding tidak valid." };
  const to = addDays(cmpFrom, active.days - 1);
  if (to >= todayUtc(now)) return { period: fallback, error: "Periode pembanding harus berakhir sebelum hari ini (UTC)." };
  const overlaps = !(to < active.from || cmpFrom > active.to);
  if (overlaps) return { period: fallback, error: "Periode pembanding tidak boleh tumpang tindih dengan periode aktif." };
  return { period: { ...active, from: cmpFrom, to, start: cmpFrom, end: addDays(to, 1) }, error: null };
}

export type CellComparisonRow = {
  lat: number;
  lon: number;
  rankA: number;
  valueA: number;
  /** null = sel tidak ada dalam hasil periode B (tidak ada baris), bukan nol terverifikasi. */
  valueB: number | null;
  classA: number;
  classB: number | null;
};

export type CellComparison = { bins: Bins | null; rows: CellComparisonRow[]; cellsA: number; cellsB: number };

export function compareCells(a: Cell[], b: Cell[], topN = 25, integer = false): CellComparison {
  const bins = quantileBins([...a.map((c) => c.value), ...b.map((c) => c.value)], 5, integer);
  const bIndex = new Map(b.map((c) => [`${c.lat},${c.lon}`, c.value]));
  const sorted = [...a].sort((x, y) => y.value - x.value);
  const rows = sorted.slice(0, topN).map((c, i) => {
    const vb = bIndex.get(`${c.lat},${c.lon}`) ?? null;
    return {
      lat: c.lat,
      lon: c.lon,
      rankA: i + 1,
      valueA: c.value,
      valueB: vb,
      classA: bins ? classIndex(c.value, bins) : 0,
      classB: vb === null ? null : bins ? classIndex(vb, bins) : 0,
    };
  });
  return { bins, rows, cellsA: a.length, cellsB: b.length };
}

export function periodsHaveSameLength(a: PeriodFilter, b: PeriodFilter): boolean {
  return dayDiff(a.from, a.to) === dayDiff(b.from, b.to);
}
