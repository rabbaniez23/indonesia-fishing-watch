import { z } from "zod";
import { getDb, newId, nowIso, transaction } from "@/lib/db";
import { cacheKey, TTL } from "@/lib/gfw/cache";
import { DATASETS, recordDatasetSuccess } from "@/lib/gfw/capabilities";
import { fetchEventsBatch, fetchEventStats, type EventStats } from "@/lib/gfw/adapters";
import { GfwError } from "@/lib/gfw/http";
import { completeJob, enqueueJob, findLatestJob, renewLease, retryOrFailJob, type Job } from "@/lib/jobs/queue";
import { getRegion, regionArea } from "@/lib/regions";
import { PortAggregator, type PortVisitsPayload } from "./aggregate";

/**
 * Job "gfw_port_visits": agregasi kunjungan pelabuhan yang DIMULAI dalam periode (timeFilterMode START-DATE)
 * di wilayah tervalidasi. Volume nyata: ±54 ribu kunjungan / 30 hari di ZEE Indonesia (fixture 28),
 * sehingga rentang dibatasi 31 hari dan diproses worker per 1.000 event.
 * Kelengkapan dicek terhadap statistik GFW (numEvents) dari query identik.
 */

export const PORT_JOB_TYPE = "gfw_port_visits";
export const PORT_MAX_DAYS = 31;
const BATCH = 1000;
const MAX_PAGES = 120;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const portJobParamsSchema = z
  .object({
    type: z.literal("port_visits"),
    regionId: z.string().min(1).max(64),
    start: z.string().regex(DATE_RE),
    end: z.string().regex(DATE_RE),
  })
  .refine((p) => Date.parse(`${p.end}T00:00:00Z`) > Date.parse(`${p.start}T00:00:00Z`), {
    message: "Tanggal akhir harus setelah tanggal mulai.",
  })
  .refine((p) => (Date.parse(`${p.end}T00:00:00Z`) - Date.parse(`${p.start}T00:00:00Z`)) / 86_400_000 <= PORT_MAX_DAYS, {
    message: `Rentang maksimal ${PORT_MAX_DAYS} hari untuk agregasi kunjungan pelabuhan.`,
  });
export type PortJobParams = z.infer<typeof portJobParamsSchema>;

export class PortJobError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function regionFor(regionId: string) {
  const region = getRegion(regionId);
  if (!region?.analyzable) throw new PortJobError("INVALID_REGION", "Wilayah tidak tervalidasi.");
  return region;
}

export function portDedupKey(params: PortJobParams, geometryHash: string) {
  return cacheKey("port-visits", DATASETS.portVisitEvents.alias, { ...params, geometryHash, timeFilterMode: "START-DATE" });
}

export type PortResult = {
  id: string;
  jobId: string;
  regionId: string;
  start: string;
  end: string;
  createdAt: string;
  freshUntil: string;
  payload: PortVisitsPayload;
  stats: EventStats | null;
  provenance: {
    datasetRequested: string;
    datasetResolved: string | null;
    fetchedAt: string;
    completeness: "complete" | "partial" | "unknown";
    warnings: string[];
    rowCount: number;
    rejectedCount: number;
  };
};

type Row = {
  id: string;
  job_id: string;
  region_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
  fresh_until: string;
  payload_json: string;
  stats_json: string | null;
  dataset_requested: string;
  dataset_resolved: string | null;
  fetched_at: string;
  completeness: "complete" | "partial" | "unknown";
  warnings_json: string;
  row_count: number;
  rejected_count: number;
};

const SELECT = `SELECT p.*, s.dataset_requested, s.dataset_resolved, s.fetched_at, s.completeness, s.warnings_json, s.row_count,
  s.rejected_count FROM port_results p JOIN source_fetches s ON s.id = p.source_fetch_id`;

function toResult(row: Row): PortResult {
  return {
    id: row.id,
    jobId: row.job_id,
    regionId: row.region_id,
    start: row.start_date,
    end: row.end_date,
    createdAt: row.created_at,
    freshUntil: row.fresh_until,
    payload: JSON.parse(row.payload_json),
    stats: row.stats_json ? JSON.parse(row.stats_json) : null,
    provenance: {
      datasetRequested: row.dataset_requested,
      datasetResolved: row.dataset_resolved,
      fetchedAt: row.fetched_at,
      completeness: row.completeness,
      warnings: JSON.parse(row.warnings_json),
      rowCount: row.row_count,
      rejectedCount: row.rejected_count,
    },
  };
}

export function findPortResult(dedupKey: string, freshOnly: boolean): PortResult | null {
  const row = getDb()
    .prepare(`${SELECT} WHERE p.dedup_key = ? ${freshOnly ? "AND p.fresh_until > ?" : ""} ORDER BY p.created_at DESC LIMIT 1`)
    .get(...(freshOnly ? [dedupKey, nowIso()] : [dedupKey])) as Row | undefined;
  return row ? toResult(row) : null;
}

export type PortPart = {
  params: PortJobParams;
  status: "ready" | "stale" | "pending" | "failed";
  result: PortResult | null;
  error: { code: string; message: string } | null;
};

/** Status bagian pelabuhan untuk render server (tanpa efek samping). */
export function loadPortPart(params: PortJobParams): PortPart {
  const region = regionFor(params.regionId);
  const key = portDedupKey(params, region.geometryHash);
  const fresh = findPortResult(key, true);
  if (fresh) return { params, status: "ready", result: fresh, error: null };
  const stale = findPortResult(key, false);
  const job = findLatestJob(key);
  if (job?.state === "failed") {
    return {
      params,
      status: stale ? "stale" : "failed",
      result: stale,
      error: { code: job.errorCode ?? "UNKNOWN", message: job.errorMessage ?? "Agregasi gagal." },
    };
  }
  return { params, status: stale ? "stale" : "pending", result: stale, error: null };
}

export function requestPortVisits(input: unknown, ownerId: string | null) {
  const params = portJobParamsSchema.parse(input);
  const region = regionFor(params.regionId);
  const key = portDedupKey(params, region.geometryHash);
  const fresh = findPortResult(key, true);
  if (fresh) return { status: "fresh" as const, resultId: fresh.id };
  const { job, created } = enqueueJob({ type: PORT_JOB_TYPE, dedupKey: key, params, ownerId, maxAttempts: 3 });
  return { status: job.state as "queued" | "running", job, created };
}

export async function processPortJob(
  job: Job,
  ctx: { workerId: string; leaseMs: number; log: (m: string) => void },
): Promise<"succeeded" | "queued" | "failed"> {
  let params: PortJobParams;
  let region: ReturnType<typeof regionFor>;
  try {
    params = portJobParamsSchema.parse(job.params);
    region = regionFor(params.regionId);
  } catch (error) {
    return retryOrFailJob(job.id, ctx.workerId, { code: "INVALID_PARAMS", message: (error as Error).message, retryable: false }) as "failed";
  }
  const area = regionArea(region);
  if (!area) return retryOrFailJob(job.id, ctx.workerId, { code: "INVALID_REGION", message: "Geometri wilayah tidak tersedia.", retryable: false }) as "failed";
  const heartbeat = setInterval(() => renewLease(job.id, ctx.workerId, ctx.leaseMs), Math.max(1000, Math.floor(ctx.leaseMs / 3)));
  try {
    const stats = await fetchEventStats({ kind: "port_visit", area, start: params.start, end: params.end, timeFilterMode: "START-DATE" });
    ctx.log(`job ${job.id}: statistik GFW ${stats.numEvents ?? "?"} kunjungan, ${stats.numVessels ?? "?"} kapal`);
    const agg = new PortAggregator();
    let offset = 0;
    let pages = 0;
    let rows = 0;
    let rejected = 0;
    let total: number | null = null;
    let datasetResolved: string | null = null;
    while (true) {
      const batch = await fetchEventsBatch({ kind: "port_visit", area, start: params.start, end: params.end, offset, limit: BATCH, timeFilterMode: "START-DATE" });
      pages += 1;
      rows += batch.events.length;
      rejected += batch.rejected;
      total = batch.total ?? total;
      datasetResolved = batch.datasetResolved ?? datasetResolved;
      agg.add(batch.events);
      if (pages % 5 === 0) ctx.log(`job ${job.id}: ${rows}/${total ?? "?"} kunjungan diproses`);
      if (batch.nextOffset === null || batch.events.length === 0) break;
      if (batch.nextOffset <= offset) throw new PortJobError("PAGINATION_ERROR", "nextOffset tidak bertambah; pagination dihentikan.");
      if (pages >= MAX_PAGES) throw new PortJobError("TOO_MANY_PAGES", `Melebihi ${MAX_PAGES} halaman; periode terlalu padat.`);
      offset = batch.nextOffset;
    }

    const payload = agg.result();
    const warnings: string[] = [];
    let completeness: "complete" | "partial" | "unknown" = "unknown";
    if (stats.numEvents !== null) {
      if (payload.totalVisits === stats.numEvents && rejected === 0) completeness = "complete";
      else {
        completeness = "partial";
        warnings.push(`Jumlah kunjungan teragregasi (${payload.totalVisits}) berbeda dari statistik GFW (${stats.numEvents}).`);
      }
    } else {
      warnings.push("Statistik GFW tidak tersedia untuk pengecekan kelengkapan.");
    }
    if (rejected > 0) warnings.push(`${rejected} event tidak sesuai kontrak dan tidak dihitung.`);
    if (agg.duplicates > 0) warnings.push(`${agg.duplicates} event duplikat antarhalaman dibuang.`);
    if (payload.visitsWithoutPort > 0) warnings.push(`${payload.visitsWithoutPort} kunjungan tanpa ID pelabuhan dikelompokkan terpisah.`);
    warnings.push("Hanya kunjungan yang dimulai dalam periode (START-DATE); kunjungan yang sudah berlangsung sebelumnya tidak dihitung.");
    recordDatasetSuccess(DATASETS.portVisitEvents.alias, datasetResolved);

    const db = getDb();
    const now = new Date();
    const sourceFetchId = newId();
    const resultId = newId();
    transaction(db, () => {
      db.prepare(
        `INSERT INTO source_fetches (id, request_hash, family, dataset_requested, dataset_resolved, region_id, geometry_hash,
           requested_start, requested_end, fetched_at, latest_observation_at, provider_available_through, completeness,
           row_count, rejected_count, warnings_json, aggregation, spatial_resolution, recovered_via_last_report)
         VALUES (?, ?, 'events', ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, 0)`,
      ).run(
        sourceFetchId,
        job.dedupKey,
        DATASETS.portVisitEvents.alias,
        datasetResolved,
        region.id,
        region.geometryHash,
        params.start,
        params.end,
        nowIso(now),
        payload.ports.reduce<string | null>((max, p) => (p.lastStart && (!max || p.lastStart > max) ? p.lastStart : max), null),
        completeness,
        rows,
        rejected,
        JSON.stringify(warnings),
        `per pelabuhan (startAnchorage.id); timeFilterMode=START-DATE; ${pages} halaman × ${BATCH}`,
      );
      db.prepare(
        `INSERT INTO port_results (id, dedup_key, job_id, region_id, geometry_hash, start_date, end_date, source_fetch_id,
           payload_json, stats_json, created_at, fresh_until)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        resultId,
        job.dedupKey,
        job.id,
        region.id,
        region.geometryHash,
        params.start,
        params.end,
        sourceFetchId,
        JSON.stringify(payload),
        JSON.stringify(stats),
        nowIso(now),
        nowIso(new Date(now.getTime() + TTL.events)),
      );
      completeJob(job.id, ctx.workerId, resultId);
    });
    ctx.log(`job ${job.id}: ${payload.totalVisits} kunjungan, ${payload.portCount} pelabuhan, kelengkapan ${completeness}`);
    return "succeeded";
  } catch (error) {
    const e =
      error instanceof PortJobError
        ? { code: error.code, message: error.message, retryable: false }
        : error instanceof z.ZodError
          ? { code: "CONTRACT_MISMATCH", message: "Respons GFW tidak sesuai kontrak yang teruji.", retryable: false }
          : error instanceof GfwError
            ? {
                code: error.code,
                message: error.message,
                retryable: ["TIMEOUT", "NETWORK", "UPSTREAM_ERROR", "RATE_LIMITED"].includes(error.code),
                delayMs: error.code === "RATE_LIMITED" ? 15 * 60_000 : undefined,
              }
            : { code: "UNEXPECTED", message: (error as Error).message, retryable: true };
    ctx.log(`job ${job.id}: gagal ${e.code} — ${e.message}`);
    return retryOrFailJob(job.id, ctx.workerId, e) as "queued" | "failed";
  } finally {
    clearInterval(heartbeat);
  }
}
