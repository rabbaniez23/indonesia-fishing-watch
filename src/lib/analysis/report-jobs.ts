import { createHash } from "node:crypto";
import { z } from "zod";
import { getDb, newId, nowIso, transaction } from "@/lib/db";
import { cacheKey, TTL } from "@/lib/gfw/cache";
import { DATASETS } from "@/lib/gfw/capabilities";
import {
  reportIdentity,
  fetchLastReport,
  normalizeReportResponse,
  REPORT_DATASETS,
  runRegionReport,
  type RegionReportParams,
  type RegionReportResult,
} from "@/lib/gfw/adapters";
import { GfwError } from "@/lib/gfw/http";
import {
  completeJob,
  enqueueJob,
  getJob,
  markUpstreamStarted,
  renewLease,
  retryOrFailJob,
  type Job,
} from "@/lib/jobs/queue";
import { acquireLock, getLock, releaseLock, renewLock, setLockMeta } from "@/lib/jobs/locks";
import { getRegion, regionArea } from "@/lib/regions";
import { aggregateCells, aggregateDaily, aggregateVessels, type ReportKind, type ReportPayload } from "./aggregate";

/**
 * Job "gfw_report": satu report 4Wings untuk (dataset, jenis agregasi, wilayah, periode).
 * Hasil disimpan immutable di report_results + provenance di source_fetches, lalu dipakai ulang selama fresh.
 */

export const REPORT_JOB_TYPE = "gfw_report";
/** Satu report GFW per akun pada satu waktu (dokumentasi report: 429 bila bersamaan). */
export const GFW_REPORT_LOCK = "gfw-report";
/** last-report hanya menyimpan hasil 30 menit; beri margin. */
const LAST_REPORT_WINDOW_MS = 25 * 60_000;
/** Batas rentang interaktif awal (PRD §6.2). */
export const MAX_RANGE_DAYS = 90;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const reportJobParamsSchema = z
  .object({
    dataset: z.enum(["fishingEffort", "presence", "sar"]),
    kind: z.enum(["daily", "cells", "vessels"]),
    regionId: z.string().min(1).max(64),
    start: z.string().regex(DATE_RE),
    end: z.string().regex(DATE_RE),
  })
  .refine((p) => Date.parse(`${p.end}T00:00:00Z`) > Date.parse(`${p.start}T00:00:00Z`), {
    message: "Tanggal akhir harus setelah tanggal mulai.",
  })
  .refine(
    (p) => (Date.parse(`${p.end}T00:00:00Z`) - Date.parse(`${p.start}T00:00:00Z`)) / 86_400_000 <= MAX_RANGE_DAYS,
    { message: `Rentang maksimal ${MAX_RANGE_DAYS} hari.` },
  );
export type ReportJobParams = z.infer<typeof reportJobParamsSchema>;

const KIND_SETTINGS: Record<ReportKind, Pick<RegionReportParams, "temporalResolution" | "spatialAggregation" | "groupBy">> = {
  daily: { temporalResolution: "DAILY", spatialAggregation: true, groupBy: "FLAG" },
  cells: { temporalResolution: "ENTIRE", spatialAggregation: false, groupBy: "FLAG" },
  vessels: { temporalResolution: "ENTIRE", spatialAggregation: true, groupBy: "VESSEL_ID" },
};

export class ReportJobError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function resolveRegion(regionId: string) {
  const region = getRegion(regionId);
  if (!region || !region.analyzable) throw new ReportJobError("INVALID_REGION", "Wilayah tidak tervalidasi.");
  return region;
}

/**
 * Versi bentuk payload per jenis. Naikkan bila agregasi menambah isi, agar hasil lama tidak dianggap lengkap.
 * vessels v2 (14 Okt 2026): rincian armada (alat tangkap, jenis kapal, bendera, sebaran per kapal).
 */
const PAYLOAD_VERSION: Partial<Record<ReportKind, number>> = { vessels: 2 };

export function reportDedupKey(params: ReportJobParams, geometryHash: string): string {
  const alias = DATASETS[REPORT_DATASETS[params.dataset].key].alias;
  const version = PAYLOAD_VERSION[params.kind];
  return cacheKey("report", alias, { ...params, geometryHash, ...(version ? { payloadVersion: version } : {}) });
}

function reportParams(params: ReportJobParams, region: NonNullable<ReturnType<typeof getRegion>>): Omit<RegionReportParams, "signal"> {
  const area = regionArea(region);
  if (!area) throw new ReportJobError("INVALID_REGION", "Geometri wilayah tidak tersedia.");
  return { dataset: params.dataset, area, start: params.start, end: params.end, ...KIND_SETTINGS[params.kind] };
}

function requestHash(query: Array<[string, string | number]>): string {
  return createHash("sha256").update(JSON.stringify(query)).digest("hex");
}

// ---------------------------------------------------------------------------
// Hasil tersimpan
// ---------------------------------------------------------------------------

export type ReportResultMeta = {
  id: string;
  jobId: string;
  datasetKey: string;
  kind: ReportKind;
  regionId: string;
  geometryHash: string;
  start: string;
  end: string;
  createdAt: string;
  freshUntil: string;
  provenance: {
    provider: "GFW";
    datasetRequested: string;
    datasetResolved: string | null;
    fetchedAt: string;
    requestedStart: string;
    requestedEnd: string;
    latestObservationAt: string | null;
    providerAvailableThrough: string | null;
    completeness: "complete" | "partial" | "unknown";
    aggregation: string;
    spatialResolution: string | null;
    warnings: string[];
    rowCount: number;
    rejectedCount: number;
    recoveredViaLastReport: boolean;
  };
};

export type ReportResult = ReportResultMeta & { payload: ReportPayload };

type ResultRow = {
  id: string;
  job_id: string;
  dataset_key: string;
  kind: ReportKind;
  region_id: string;
  geometry_hash: string;
  start_date: string;
  end_date: string;
  created_at: string;
  fresh_until: string;
  payload_json?: string;
  dataset_requested: string;
  dataset_resolved: string | null;
  fetched_at: string;
  latest_observation_at: string | null;
  provider_available_through: string | null;
  completeness: "complete" | "partial" | "unknown";
  aggregation: string;
  spatial_resolution: string | null;
  warnings_json: string;
  row_count: number;
  rejected_count: number;
  recovered_via_last_report: number;
};

const RESULT_SELECT = `
  SELECT r.id, r.job_id, r.dataset_key, r.kind, r.region_id, r.geometry_hash, r.start_date, r.end_date, r.created_at,
         r.fresh_until, %PAYLOAD% s.dataset_requested, s.dataset_resolved, s.fetched_at, s.latest_observation_at,
         s.provider_available_through, s.completeness, s.aggregation, s.spatial_resolution, s.warnings_json,
         s.row_count, s.rejected_count, s.recovered_via_last_report
  FROM report_results r JOIN source_fetches s ON s.id = r.source_fetch_id`;

function toMeta(row: ResultRow): ReportResultMeta {
  return {
    id: row.id,
    jobId: row.job_id,
    datasetKey: row.dataset_key,
    kind: row.kind,
    regionId: row.region_id,
    geometryHash: row.geometry_hash,
    start: row.start_date,
    end: row.end_date,
    createdAt: row.created_at,
    freshUntil: row.fresh_until,
    provenance: {
      provider: "GFW",
      datasetRequested: row.dataset_requested,
      datasetResolved: row.dataset_resolved,
      fetchedAt: row.fetched_at,
      requestedStart: row.start_date,
      requestedEnd: row.end_date,
      latestObservationAt: row.latest_observation_at,
      providerAvailableThrough: row.provider_available_through,
      completeness: row.completeness,
      aggregation: row.aggregation,
      spatialResolution: row.spatial_resolution,
      warnings: JSON.parse(row.warnings_json),
      rowCount: row.row_count,
      rejectedCount: row.rejected_count,
      recoveredViaLastReport: row.recovered_via_last_report === 1,
    },
  };
}

export function getReportResult(id: string, withPayload = true): ReportResult | ReportResultMeta | null {
  const sql = RESULT_SELECT.replace("%PAYLOAD%", withPayload ? "r.payload_json," : "") + " WHERE r.id = ?";
  const row = getDb().prepare(sql).get(id) as ResultRow | undefined;
  if (!row) return null;
  const meta = toMeta(row);
  return withPayload ? { ...meta, payload: JSON.parse(row.payload_json!) } : meta;
}

export function findFreshResult(dedupKey: string, now: Date = new Date()): ReportResultMeta | null {
  const sql = RESULT_SELECT.replace("%PAYLOAD%", "") + " WHERE r.dedup_key = ? AND r.fresh_until > ? ORDER BY r.created_at DESC LIMIT 1";
  const row = getDb().prepare(sql).get(dedupKey, nowIso(now)) as ResultRow | undefined;
  return row ? toMeta(row) : null;
}

/** Hasil terbaru walau sudah tidak fresh — boleh ditampilkan sebagai "stale" dengan label (FR-12). */
export function findLatestResult(dedupKey: string): ReportResultMeta | null {
  const sql = RESULT_SELECT.replace("%PAYLOAD%", "") + " WHERE r.dedup_key = ? ORDER BY r.created_at DESC LIMIT 1";
  const row = getDb().prepare(sql).get(dedupKey) as ResultRow | undefined;
  return row ? toMeta(row) : null;
}

// ---------------------------------------------------------------------------
// Permintaan dari web (tidak pernah memanggil GFW langsung; hanya antre)
// ---------------------------------------------------------------------------

export type ReportRequestOutcome =
  | { status: "fresh"; result: ReportResultMeta }
  | { status: "queued" | "running" | "failed"; job: Job; created: boolean; stale: ReportResultMeta | null };

export function requestReport(input: unknown, ownerId: string | null): ReportRequestOutcome {
  const params = reportJobParamsSchema.parse(input);
  const region = resolveRegion(params.regionId);
  const dedupKey = reportDedupKey(params, region.geometryHash);
  const fresh = findFreshResult(dedupKey);
  if (fresh) return { status: "fresh", result: fresh };
  const { job, created } = enqueueJob({ type: REPORT_JOB_TYPE, dedupKey, params, ownerId });
  return { status: job.state as "queued" | "running", job, created, stale: findLatestResult(dedupKey) };
}

// ---------------------------------------------------------------------------
// Pemrosesan oleh worker
// ---------------------------------------------------------------------------

export type WorkerContext = {
  workerId: string;
  leaseMs: number;
  log: (message: string) => void;
  /** Interval polling last-report (ms). */
  lastReportPollMs?: number;
  lastReportMaxPolls?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clearUpstream(jobId: string) {
  getDb().prepare("UPDATE jobs SET upstream_started_at = NULL, upstream_request_hash = NULL WHERE id = ?").run(jobId);
}

/** Tunggu last-report hingga selesai. Hanya dipanggil bila report terakhir akun dipastikan milik job ini. */
async function recoverViaLastReport(job: Job, ctx: WorkerContext, params: ReportJobParams): Promise<RegionReportResult> {
  const pollMs = ctx.lastReportPollMs ?? 15_000;
  const maxPolls = ctx.lastReportMaxPolls ?? 20;
  for (let i = 0; i < maxPolls; i++) {
    const state = await fetchLastReport();
    if (state.state === "finished") {
      const result = normalizeReportResponse(state.json, params.dataset, state.xDatasets);
      try {
        assertMatchesRequest(result, params);
      } catch (error) {
        // Bukan report milik job ini (mis. token dipakai di luar aplikasi): lupakan jejak, coba report baru.
        clearUpstream(job.id);
        throw new GfwError("UPSTREAM_ERROR", (error as Error).message, null, true);
      }
      ctx.log(`job ${job.id}: hasil dipulihkan lewat last-report (cocok dengan permintaan)`);
      return result;
    }
    if (state.state === "failed") throw new ReportJobError("UPSTREAM_REPORT_FAILED", `Report GFW gagal: ${state.detail ?? "-"}`);
    if (state.state === "not_found") {
      clearUpstream(job.id);
      throw new GfwError("UPSTREAM_ERROR", "Hasil report terakhir tidak tersedia lagi (last-report 404).", 404, true);
    }
    ctx.log(`job ${job.id}: report masih berjalan di GFW (poll ${i + 1}/${maxPolls})`);
    await sleep(pollMs);
  }
  throw new GfwError("REPORT_TIMEOUT", "Report GFW belum selesai setelah batas polling.", null, true);
}

/**
 * last-report tidak memuat penanda report. Hasil pulihan wajib cocok dengan permintaan:
 * dataset dasar sama, bentuk baris sesuai jenis agregasi, dan tanggal berada dalam periode.
 */
export function assertMatchesRequest(result: RegionReportResult, params: ReportJobParams): void {
  const expectedBase = DATASETS[REPORT_DATASETS[params.dataset].key].alias.split(":")[0];
  const resolvedBase = result.datasetResolved?.split(":")[0] ?? null;
  const mismatch = (why: string) => {
    throw new ReportJobError("LAST_REPORT_MISMATCH", `Hasil last-report tidak cocok dengan permintaan (${why}).`);
  };
  if (resolvedBase !== expectedBase) mismatch(`dataset ${resolvedBase ?? "-"}`);
  for (const row of result.rows) {
    if (params.kind === "cells" && (row.lat === null || row.lon === null)) mismatch("baris tanpa koordinat sel");
    if (params.kind !== "cells" && row.lat !== null) mismatch("baris berkoordinat pada report agregat");
    if (params.kind === "vessels" && !row.vessel) mismatch("baris tanpa vessel ID");
    if (params.kind === "daily") {
      if (row.date < params.start || row.date >= params.end) mismatch(`tanggal ${row.date} di luar periode`);
    } else if (row.date !== `${params.start},${params.end}`) {
      mismatch(`periode ${row.date}`);
    }
  }
}

function classifyError(error: unknown): { code: string; message: string; retryable: boolean; delayMs?: number } {
  if (error instanceof ReportJobError) return { code: error.code, message: error.message, retryable: false };
  if (error instanceof z.ZodError) {
    // Bentuk respons berbeda dari kontrak yang teruji: jangan di-retry, perlu contract check ulang.
    return { code: "CONTRACT_MISMATCH", message: "Respons GFW tidak sesuai kontrak yang teruji.", retryable: false };
  }
  if (error instanceof GfwError) {
    switch (error.code) {
      case "RATE_LIMITED":
        return { code: error.code, message: error.message, retryable: true, delayMs: 15 * 60_000 };
      case "REPORT_IN_PROGRESS":
        return { code: error.code, message: error.message, retryable: true, delayMs: 60_000 };
      case "TIMEOUT":
      case "NETWORK":
      case "UPSTREAM_ERROR":
      case "REPORT_TIMEOUT":
        return { code: error.code, message: error.message, retryable: error.retryable || error.code === "REPORT_TIMEOUT" };
      default:
        // UNAUTHENTICATED, FORBIDDEN, INVALID_REQUEST, NOT_CONFIGURED, BUDGET_EXCEEDED: tidak di-retry otomatis.
        return { code: error.code, message: error.message, retryable: false };
    }
  }
  return { code: "UNEXPECTED", message: error instanceof Error ? error.message : String(error), retryable: true };
}

export async function processReportJob(job: Job, ctx: WorkerContext): Promise<"succeeded" | "queued" | "failed"> {
  let params: ReportJobParams;
  let region: NonNullable<ReturnType<typeof getRegion>>;
  try {
    params = reportJobParamsSchema.parse(job.params);
    region = resolveRegion(params.regionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return retryOrFailJob(job.id, ctx.workerId, { code: "INVALID_PARAMS", message, retryable: false }) as "failed";
  }

  if (!acquireLock(GFW_REPORT_LOCK, ctx.workerId, ctx.leaseMs)) {
    ctx.log(`job ${job.id}: lock report GFW sedang dipakai; ditunda`);
    return retryOrFailJob(job.id, ctx.workerId, { code: "LOCK_BUSY", message: "Menunggu report lain selesai.", retryable: true, delayMs: 10_000 }, false) as "queued";
  }

  const heartbeat = setInterval(() => {
    renewLease(job.id, ctx.workerId, ctx.leaseMs);
    renewLock(GFW_REPORT_LOCK, ctx.workerId, ctx.leaseMs);
  }, Math.max(1_000, Math.floor(ctx.leaseMs / 3)));

  try {
    const rp = reportParams(params, region);
    const hash = requestHash(reportIdentity(rp));
    const lockMeta = getLock(GFW_REPORT_LOCK)?.meta as { jobId?: string; requestHash?: string; startedAt?: string } | null;
    const fresh = getJob(job.id)!;
    const canRecover =
      !!fresh.upstreamStartedAt &&
      fresh.upstreamRequestHash === hash &&
      lockMeta?.jobId === job.id &&
      lockMeta?.requestHash === hash &&
      Date.now() - Date.parse(fresh.upstreamStartedAt) < LAST_REPORT_WINDOW_MS;

    let result: RegionReportResult;
    let recovered = false;
    if (canRecover) {
      ctx.log(`job ${job.id}: melanjutkan report yang sudah dimulai (tanpa membuat report baru)`);
      result = await recoverViaLastReport(job, ctx, params);
      recovered = true;
    } else {
      setLockMeta(GFW_REPORT_LOCK, ctx.workerId, { jobId: job.id, requestHash: hash, startedAt: nowIso() });
      markUpstreamStarted(job.id, hash);
      ctx.log(`job ${job.id}: memulai report GFW ${params.dataset}/${params.kind} ${params.start}..${params.end}`);
      try {
        result = await runRegionReport(rp);
      } catch (error) {
        if (error instanceof GfwError && error.code === "REPORT_TIMEOUT") {
          ctx.log(`job ${job.id}: 524 dari gateway; memantau last-report`);
          result = await recoverViaLastReport(job, ctx, params);
          recovered = true;
        } else {
          throw error;
        }
      }
    }

    saveResult(job, params, region, result, recovered);
    return "succeeded";
  } catch (error) {
    const classified = classifyError(error);
    ctx.log(`job ${job.id}: gagal ${classified.code} — ${classified.message}`);
    return retryOrFailJob(job.id, ctx.workerId, classified) as "queued" | "failed";
  } finally {
    clearInterval(heartbeat);
    releaseLock(GFW_REPORT_LOCK, ctx.workerId);
  }
}

function saveResult(
  job: Job,
  params: ReportJobParams,
  region: NonNullable<ReturnType<typeof getRegion>>,
  result: RegionReportResult,
  recovered: boolean,
) {
  const metric = REPORT_DATASETS[params.dataset].metric;
  const payload: ReportPayload =
    params.kind === "daily"
      ? aggregateDaily(result.rows, metric, params.start, params.end)
      : params.kind === "cells"
        ? aggregateCells(result.rows, metric)
        : aggregateVessels(result.rows, metric);

  const warnings: string[] = [];
  if (Object.keys(result.providerMetadata).length === 0) {
    warnings.push("Provider tidak menyertakan metadata ketersediaan; kelengkapan belum diketahui.");
  }
  if (result.rejected > 0) warnings.push(`${result.rejected} baris tidak sesuai kontrak dan tidak dihitung.`);
  if (payload.kind === "daily" && payload.daysWithoutRows.length > 0) {
    warnings.push(`${payload.daysWithoutRows.length} hari tanpa baris dari provider (bukan nol terverifikasi).`);
  }
  if (payload.kind === "vessels" && payload.rowsWithoutVesselId > 0) {
    warnings.push(`${payload.rowsWithoutVesselId} baris tanpa vessel ID dilaporkan terpisah.`);
  }

  const latestObservationAt =
    payload.kind === "daily" ? payload.latestObservationDate : payload.kind === "vessels" ? payload.latestObservationAt : null;
  const settings = KIND_SETTINGS[params.kind];
  const now = new Date();
  const db = getDb();
  const sourceFetchId = newId();
  const resultId = newId();
  const dedupKey = reportDedupKey(params, region.geometryHash);

  transaction(db, () => {
    db.prepare(
      `INSERT INTO source_fetches (id, request_hash, family, dataset_requested, dataset_resolved, region_id, geometry_hash,
         requested_start, requested_end, fetched_at, latest_observation_at, provider_available_through, completeness,
         row_count, rejected_count, warnings_json, aggregation, spatial_resolution, recovered_via_last_report)
       VALUES (?, ?, '4wings', ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sourceFetchId,
      getJob(job.id)?.upstreamRequestHash ?? "",
      result.datasetRequested,
      result.datasetResolved,
      region.id,
      region.geometryHash,
      params.start,
      params.end,
      result.fetchedAt,
      latestObservationAt,
      result.rejected > 0 ? "partial" : "unknown",
      result.rows.length,
      result.rejected,
      JSON.stringify(warnings),
      `group-by=${settings.groupBy}; temporal=${settings.temporalResolution}; spatial-aggregation=${settings.spatialAggregation}`,
      settings.spatialAggregation ? null : "LOW (0,1°)",
      recovered ? 1 : 0,
    );
    db.prepare(
      `INSERT INTO report_results (id, dedup_key, job_id, dataset_key, kind, region_id, geometry_hash, start_date, end_date,
         source_fetch_id, payload_json, created_at, fresh_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      resultId,
      dedupKey,
      job.id,
      params.dataset,
      params.kind,
      region.id,
      region.geometryHash,
      params.start,
      params.end,
      sourceFetchId,
      JSON.stringify(payload),
      nowIso(now),
      nowIso(new Date(now.getTime() + TTL.analysis)),
    );
    completeJob(job.id, job.leaseOwner ?? "", resultId);
  });
}
