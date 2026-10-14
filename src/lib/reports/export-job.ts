import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { CellsResult, DailyResult } from "@/lib/analysis/aggregate";
import { loadPart } from "@/lib/analysis/parts";
import { requestReport, type ReportJobParams } from "@/lib/analysis/report-jobs";
import { DATASETS } from "@/lib/gfw/capabilities";
import { EVENT_KINDS, fetchEventsBatch, type EventKind } from "@/lib/gfw/adapters";
import { GfwError } from "@/lib/gfw/http";
import type { NormalizedEvent } from "@/lib/gfw/schemas";
import { completeJob, renewLease, retryOrFailJob, type Job } from "@/lib/jobs/queue";
import { CELL_HALF_DEG, MAP_LAYERS } from "@/lib/map/layers";
import { loadPortPart, requestPortVisits } from "@/lib/ports/port-jobs";
import { getRegion, regionArea } from "@/lib/regions";
import { getDb, nowIso } from "@/lib/db";
import { toCsv, type CsvValue } from "./csv";
import { REPORT_TTL_DAYS, REPORT_TYPE_LABEL, type CreateReportInput } from "./model";
import { completeReport, getReport, getReportDeferrals, markReport, reportsDir } from "./service";
import { writeZip } from "./zip-writer";

/**
 * Job "report_export" (FR-10): menyusun CSV dari snapshot yang sama dengan UI (loadPart / loadPortPart).
 * Bila snapshot belum ada, job sumber diantre dan ekspor ditunda (tidak menghitung percobaan), dibatasi MAX_DEFERRALS.
 */

const MAX_DEFERRALS = 60; // ±15 menit dengan jeda 15 detik
const EVENTS_MAX_PAGES = 20;

class WaitingForSource extends Error {}
class ExportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Meta = Array<[string, CsvValue]>;
type Built = { header: string[]; rows: CsvValue[][]; meta: Meta; refs: string[]; completeness: "complete" | "partial" | "unknown" };

const addDay = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function needReport(params: ReportJobParams, ownerId: string | null) {
  const region = getRegion(params.regionId)!;
  const part = loadPart<DailyResult | CellsResult>(params, region.geometryHash);
  if (part.status === "ready") return part.result!;
  if (part.status === "failed" || part.error) {
    throw new ExportError("SOURCE_FAILED", `Sumber ${params.dataset}/${params.kind} gagal diambil (${part.error?.code ?? "galat"}).`);
  }
  requestReport(params, ownerId);
  throw new WaitingForSource();
}

function provenanceMeta(prefix: string, p: { datasetRequested: string; datasetResolved: string | null; fetchedAt: string; completeness: string; aggregation?: string; spatialResolution?: string | null; warnings: string[] }): Meta {
  const meta: Meta = [
    [`${prefix}dataset_diminta`, p.datasetRequested],
    [`${prefix}dataset_dilayani`, p.datasetResolved ?? "belum diketahui"],
    [`${prefix}diambil_pada_utc`, p.fetchedAt],
    [`${prefix}kelengkapan`, p.completeness],
  ];
  if (p.aggregation) meta.push([`${prefix}agregasi`, p.aggregation]);
  if (p.spatialResolution) meta.push([`${prefix}resolusi_spasial`, p.spatialResolution]);
  p.warnings.forEach((w, i) => meta.push([`${prefix}catatan_${i + 1}`, w]));
  return meta;
}

function worst(values: string[]): "complete" | "partial" | "unknown" {
  if (values.includes("partial")) return "partial";
  if (values.includes("unknown")) return "unknown";
  return "complete";
}

function buildDaily(params: Extract<CreateReportInput, { type: "ringkasan_harian" }>, ownerId: string | null): Built {
  const base = { regionId: params.regionId, start: params.from, end: addDay(params.to, 1), kind: "daily" as const };
  // Antre SEMUA sumber yang belum ada sekaligus, baru menunggu (bukan satu per satu per penundaan).
  let waiting = false;
  const maybe = (["fishingEffort", "presence", "sar"] as const).map((dataset) => {
    try {
      return needReport({ ...base, dataset }, ownerId) as unknown as { id: string; payload: DailyResult; provenance: Parameters<typeof provenanceMeta>[1] };
    } catch (error) {
      if (error instanceof WaitingForSource) {
        waiting = true;
        return null;
      }
      throw error;
    }
  });
  if (waiting) throw new WaitingForSource();
  const sets = maybe as NonNullable<(typeof maybe)[number]>[];
  const days = sets[0].payload.series.map((p) => p.date);
  const rows = days.map((date, i) => [date, ...sets.map((s) => s.payload.series[i]?.value ?? null)]);
  const meta: Meta = [
    ["satuan_jam_apparent_fishing", "jam"],
    ["satuan_jam_keberadaan_ais", "jam"],
    ["satuan_deteksi_radar", "deteksi"],
    ["total_jam_apparent_fishing", sets[0].payload.total],
    ["total_jam_keberadaan_ais", sets[1].payload.total],
    ["total_deteksi_radar", sets[2].payload.total],
    ["sel_kosong", "Hari tanpa baris dari provider dibiarkan kosong (bukan nol terverifikasi)."],
    ...provenanceMeta("fishing_", sets[0].provenance),
    ...provenanceMeta("keberadaan_", sets[1].provenance),
    ...provenanceMeta("radar_", sets[2].provenance),
  ];
  return {
    header: ["tanggal_utc", "jam_apparent_fishing", "jam_keberadaan_ais", "deteksi_radar"],
    rows,
    meta,
    refs: sets.map((s) => s.id),
    completeness: worst(sets.map((s) => s.provenance.completeness)),
  };
}

function buildCells(params: Extract<CreateReportInput, { type: "sel_grid" }>, ownerId: string | null): Built {
  const result = needReport(
    { regionId: params.regionId, start: params.from, end: addDay(params.to, 1), kind: "cells", dataset: params.layer },
    ownerId,
  ) as unknown as { id: string; payload: CellsResult; provenance: Parameters<typeof provenanceMeta>[1] };
  const unit = MAP_LAYERS[params.layer].unit;
  const valueCol = `${params.layer === "sar" ? "deteksi" : "jam"}_${params.layer}`;
  const rows = result.payload.cells.map((c, i) => {
    const [flag, v] = c.byFlag[0] ?? [null, 0];
    return [
      i + 1,
      c.lat,
      c.lon,
      +(c.lat - CELL_HALF_DEG).toFixed(4),
      +(c.lat + CELL_HALF_DEG).toFixed(4),
      +(c.lon - CELL_HALF_DEG).toFixed(4),
      +(c.lon + CELL_HALF_DEG).toFixed(4),
      c.value,
      flag ?? "tidak_diketahui",
      c.value > 0 ? +((v / c.value) * 100).toFixed(1) : null,
    ];
  });
  return {
    header: ["peringkat", "lat_titik_tengah", "lon_titik_tengah", "lat_min", "lat_max", "lon_min", "lon_max", valueCol, "bendera_utama", "porsi_bendera_utama_persen"],
    rows,
    meta: [
      ["layer", MAP_LAYERS[params.layer].metricLabel],
      [`satuan_${valueCol}`, unit],
      ["jumlah_sel", result.payload.cellCount],
      ["total", result.payload.total],
      ["definisi_sel", "Sel 0,1°; koordinat GFW = titik tengah sel (diverifikasi empiris). Sel bukan posisi presisi kapal."],
      ...provenanceMeta("", result.provenance),
    ],
    refs: [result.id],
    completeness: worst([result.provenance.completeness]),
  };
}

function buildPorts(params: Extract<CreateReportInput, { type: "kunjungan_pelabuhan" }>, ownerId: string | null): Built {
  const portParams = { type: "port_visits" as const, regionId: params.regionId, start: params.from, end: addDay(params.to, 1) };
  const part = loadPortPart(portParams);
  if (part.status !== "ready") {
    if (part.error) throw new ExportError("SOURCE_FAILED", `Agregasi kunjungan gagal (${part.error.code}).`);
    requestPortVisits(portParams, ownerId);
    throw new WaitingForSource();
  }
  const r = part.result!;
  const rows = r.payload.ports.map((p) => [
    p.portId ?? "tanpa_id",
    p.name,
    p.flag,
    p.visits,
    p.vessels,
    p.medianDurationHours === null ? null : +p.medianDurationHours.toFixed(2),
    p.confidence["2"],
    p.confidence["3"],
    p.confidence["4"],
    p.confidence.other,
    p.atDockShare === null ? null : +(p.atDockShare * 100).toFixed(1),
    p.firstStart,
    p.lastStart,
  ]);
  return {
    header: ["id_pelabuhan_gfw", "nama", "negara_gfw", "kunjungan", "id_kapal_unik", "durasi_median_jam", "confidence_2", "confidence_3", "confidence_4", "confidence_lain", "porsi_di_dermaga_persen", "mulai_pertama_utc", "mulai_terakhir_utc"],
    rows,
    meta: [
      ["total_kunjungan", r.payload.totalVisits],
      ["total_id_kapal_unik", r.payload.totalVessels],
      ["statistik_gfw_kunjungan", r.stats?.numEvents ?? null],
      ["statistik_gfw_kapal", r.stats?.numVessels ?? null],
      ["definisi", "Kunjungan yang dimulai dalam periode (timeFilterMode START-DATE); pelabuhan = startAnchorage.id GFW, bukan kode resmi nasional."],
      ["caveat_kunjungan", "Kunjungan pelabuhan teramati dari AIS; bukan bukti bongkar hasil tangkapan."],
      ...provenanceMeta("", { ...r.provenance, aggregation: "per pelabuhan (startAnchorage.id)" }),
    ],
    refs: [r.id],
    completeness: r.provenance.completeness,
  };
}

async function buildVesselEvents(params: Extract<CreateReportInput, { type: "kejadian_kapal" }>, heartbeat: () => void): Promise<Built> {
  const region = getRegion(params.regionId)!;
  const rows: CsvValue[][] = [];
  const meta: Meta = [];
  const completeness: string[] = [];
  for (const kind of params.kinds as EventKind[]) {
    const seen = new Set<string>();
    let offset = 0;
    let total: number | null = null;
    let resolved: string | null = null;
    for (let page = 0; page < EVENTS_MAX_PAGES; page++) {
      heartbeat();
      const batch = await fetchEventsBatch({
        kind,
        area: regionArea(region)!,
        start: params.from,
        end: addDay(params.to, 1),
        offset,
        limit: 1000,
        vesselIds: [params.vesselId],
      });
      total = batch.total ?? total;
      resolved = batch.datasetResolved ?? resolved;
      for (const e of batch.events) {
        if (e.vessel.id !== params.vesselId || seen.has(e.id)) continue;
        seen.add(e.id);
        rows.push(eventRow(e));
      }
      if (batch.nextOffset === null || batch.events.length === 0) break;
      offset = batch.nextOffset;
    }
    const complete = total !== null && seen.size === total;
    completeness.push(complete ? "complete" : "partial");
    meta.push(
      [`${kind}_dataset_diminta`, DATASETS[EVENT_KINDS[kind]].alias],
      [`${kind}_dataset_dilayani`, resolved ?? "belum diketahui"],
      [`${kind}_jumlah`, seen.size],
      [`${kind}_total_gfw`, total],
      [`${kind}_kelengkapan`, complete ? "complete" : "partial"],
    );
  }
  rows.sort((a, b) => String(a[2]).localeCompare(String(b[2])));
  meta.push(
    ["kapal_gfw_id", params.vesselId],
    ["diambil_pada_utc", nowIso()],
    ["definisi_waktu", "Kejadian yang overlap periode (timeFilterMode OVERLAP, sama dengan profil kapal); durasi dari interval mulai–selesai."],
    ["caveat_kejadian", "Fishing = perkiraan perilaku dari AIS; encounter bukan bukti transshipment; kunjungan pelabuhan bukan bukti bongkar."],
  );
  return {
    header: ["id_kejadian", "jenis", "mulai_utc", "selesai_utc", "durasi_jam", "lat_representatif", "lon_representatif", "kapal_id", "kapal_nama", "mmsi", "bendera", "jarak_km", "kecepatan_rata2_knot", "kapal_lain_id", "kapal_lain_nama", "pelabuhan_id_gfw", "pelabuhan_nama", "confidence"],
    rows,
    meta,
    refs: [],
    completeness: worst(completeness),
  };
}

function eventRow(e: NormalizedEvent): CsvValue[] {
  return [
    e.id,
    e.type,
    e.start,
    e.end,
    e.durationHours === null ? null : +e.durationHours.toFixed(3),
    e.position?.lat ?? null,
    e.position?.lon ?? null,
    e.vessel.id,
    e.vessel.name,
    e.vessel.ssvid,
    e.vessel.flag,
    e.fishing?.totalDistanceKm ?? e.loitering?.totalDistanceKm ?? null,
    e.fishing?.averageSpeedKnots ?? e.loitering?.averageSpeedKnots ?? null,
    e.encounter?.otherVessel?.id ?? null,
    e.encounter?.otherVessel?.name ?? null,
    e.portVisit?.startAnchorage?.id ?? null,
    e.portVisit?.startAnchorage?.name ?? null,
    e.portVisit?.confidence ?? null,
  ];
}

export const exportJobParamsSchema = z.object({ reportId: z.string().min(1).max(64) });

export async function processExportJob(job: Job, ctx: { workerId: string; leaseMs: number; log: (m: string) => void }): Promise<"succeeded" | "queued" | "failed"> {
  const { reportId } = exportJobParamsSchema.parse(job.params);
  const report = getReport(reportId);
  if (!report) return retryOrFailJob(job.id, ctx.workerId, { code: "NOT_FOUND", message: "Laporan tidak ditemukan.", retryable: false }) as "failed";
  markReport(reportId, { status: "diproses" });
  const heartbeat = () => renewLease(job.id, ctx.workerId, ctx.leaseMs);
  try {
    const p = report.params;
    const built =
      p.type === "ringkasan_harian"
        ? buildDaily(p, report.createdBy.id)
        : p.type === "sel_grid"
          ? buildCells(p, report.createdBy.id)
          : p.type === "kunjungan_pelabuhan"
            ? buildPorts(p, report.createdBy.id)
            : await buildVesselEvents(p, heartbeat);

    const region = getRegion(p.regionId)!;
    const creator = getDb().prepare("SELECT name FROM users WHERE id = ?").get(report.createdBy.id) as { name: string } | undefined;
    const meta: Meta = [
      ["laporan_id", report.id],
      ["jenis", REPORT_TYPE_LABEL[p.type]],
      ["dibuat_pada_utc", nowIso()],
      ["dibuat_oleh", creator?.name ?? report.createdBy.id],
      ["wilayah", `${region.name} (${region.id})`],
      ["sumber_geometri", region.source],
      ["hash_geometri_sha256", region.geometryHash],
      ["periode_mulai_utc", p.from],
      ["periode_akhir_utc_inklusif", p.to],
      ["kelengkapan_keseluruhan", built.completeness],
      ["jumlah_baris_data", built.rows.length],
      ["format_angka", "Titik desimal, tanpa pemisah ribuan; sel kosong = tidak tersedia (bukan nol)."],
      ["zona_waktu", "Semua tanggal & waktu dalam UTC."],
      ["referensi_snapshot", built.refs.join(" ")],
      ...built.meta,
      ["atribusi", "Powered by Global Fishing Watch (globalfishingwatch.org). Penggunaan nonkomersial sesuai lisensi GFW."],
      ["batas_interpretasi", "Data aktivitas teramati; bukan penetapan pelanggaran, jumlah tangkapan, atau posisi langsung kapal."],
    ];
    const zip = writeZip([
      { name: "data.csv", data: Buffer.from(toCsv(built.header, built.rows), "utf8") },
      { name: "metadata.csv", data: Buffer.from(toCsv(["kunci", "nilai"], meta), "utf8") },
    ]);
    const dir = reportsDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${report.id}.zip`), zip);
    const fileName = `indonesia-fishing-watch_${p.type}_${p.from}_${p.to}.zip`;
    completeReport(report.id, {
      name: fileName,
      size: zip.length,
      rows: built.rows.length,
      completeness: built.completeness,
      refs: built.refs,
      expiresAt: new Date(Date.now() + REPORT_TTL_DAYS * 86_400_000).toISOString(),
    });
    completeJob(job.id, ctx.workerId, report.id);
    ctx.log(`laporan ${report.id}: ${built.rows.length} baris, ${zip.length} byte, kelengkapan ${built.completeness}`);
    return "succeeded";
  } catch (error) {
    if (error instanceof WaitingForSource) {
      const deferrals = getReportDeferrals(reportId) + 1;
      if (deferrals > MAX_DEFERRALS) {
        markReport(reportId, { status: "gagal", errorCode: "SOURCE_TIMEOUT", errorMessage: "Sumber data belum siap setelah menunggu." });
        return retryOrFailJob(job.id, ctx.workerId, { code: "SOURCE_TIMEOUT", message: "Sumber data belum siap setelah menunggu.", retryable: false }) as "failed";
      }
      markReport(reportId, { status: "antre", deferrals });
      ctx.log(`laporan ${reportId}: menunggu snapshot sumber (${deferrals}/${MAX_DEFERRALS})`);
      return retryOrFailJob(job.id, ctx.workerId, { code: "WAITING_SOURCE", message: "Menunggu snapshot sumber.", retryable: true, delayMs: 15_000 }, false) as "queued";
    }
    const e =
      error instanceof ExportError
        ? { code: error.code, message: error.message, retryable: false }
        : error instanceof GfwError
          ? { code: error.code, message: error.message, retryable: ["TIMEOUT", "NETWORK", "UPSTREAM_ERROR"].includes(error.code) }
          : { code: "UNEXPECTED", message: (error as Error).message, retryable: false };
    const state = retryOrFailJob(job.id, ctx.workerId, e);
    markReport(reportId, state === "failed" ? { status: "gagal", errorCode: e.code, errorMessage: e.message } : { status: "antre" });
    ctx.log(`laporan ${reportId}: gagal ${e.code} — ${e.message}`);
    return state as "queued" | "failed";
  }
}
