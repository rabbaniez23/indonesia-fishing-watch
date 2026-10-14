import { cached, cacheKey, TTL } from "./cache";
import { DATASETS, recordDatasetSuccess, resolvedVersionFromHeader, type DatasetKey } from "./capabilities";
import { GfwError, gfwRequest } from "./http";
import {
  eezRegionListSchema,
  eventsPageSchema,
  normalizeEvents,
  normalizeReport,
  vesselIdentitySchema,
  vesselSearchSchema,
  type EezRegion,
  type NormalizedEvent,
  type NormalizedReport,
  type ReportMetric,
  type VesselIdentity,
} from "./schemas";

/**
 * Adapter per family (Vessels, Events, 4Wings, Regions). Semua path & parameter di sini
 * sudah dibuktikan lewat contract check 13 Okt 2026 (lihat fixtures/gfw), kecuali yang ditandai.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertDateRange(start: string, end: string, maxDays = 366): void {
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    throw new GfwError("INVALID_REQUEST", "Format tanggal harus YYYY-MM-DD (hari UTC).");
  }
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!(b > a)) throw new GfwError("INVALID_REQUEST", "Tanggal akhir harus setelah tanggal mulai.");
  if ((b - a) / 86_400_000 > maxDays) throw new GfwError("INVALID_REQUEST", `Rentang maksimal ${maxDays} hari.`);
}

export type RegionRef = { dataset: typeof DATASETS.eezRegions.alias; id: number };

export type AreaGeometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };

/**
 * Cakupan query GFW: region bawaan GFW (body/query `region`) atau poligon sendiri (WPP).
 * Poligon terbukti diterima (fixture 32–34): report = POST body `{geojson: FeatureCollection}`,
 * events & events/stats = body `{geometry}`. Kunci cache memakai hash geometri, bukan koordinatnya.
 */
export type AreaRef = { region: RegionRef } | { geometry: AreaGeometry; geometryHash: string };

export function areaBody(area: AreaRef): Record<string, unknown> {
  return "region" in area ? { region: area.region } : { geometry: area.geometry };
}

export function areaKey(area: AreaRef): Record<string, unknown> {
  return "region" in area ? { region: area.region } : { geometryHash: area.geometryHash };
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export async function listEezRegions(): Promise<{ regions: EezRegion[]; fetchedAt: string }> {
  const key = cacheKey("regions", DATASETS.eezRegions.alias, {});
  const result = await cached(key, "regions", DATASETS.eezRegions.alias, TTL.regions, async () => {
    const res = await gfwRequest({ path: `/v3/datasets/${DATASETS.eezRegions.alias}/context-layers` });
    return { value: eezRegionListSchema.parse(res.json) };
  });
  return { regions: result.value, fetchedAt: result.fetchedAt };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const EVENT_KINDS = {
  fishing: "fishingEvents",
  port_visit: "portVisitEvents",
  encounter: "encounterEvents",
  loitering: "loiteringEvents",
} as const satisfies Record<string, DatasetKey>;
export type EventKind = keyof typeof EVENT_KINDS;

export type EventsPage = {
  events: NormalizedEvent[];
  rejected: number;
  total: number | null;
  offset: number;
  nextOffset: number | null;
  datasetRequested: string;
  datasetResolved: string | null;
  fetchedAt: string;
  fromCache: boolean;
};

export async function fetchEventsPage(params: {
  kind: EventKind;
  area: AreaRef;
  start: string;
  end: string;
  offset?: number;
  limit?: number;
  /** Filter GFW vessel ID (body `vessels`) — terbukti, fixture 16–18. */
  vesselIds?: string[];
  /** Filter ID pelabuhan GFW (body `portIds`) — terbukti, fixture 29. */
  portIds?: string[];
  /** OVERLAP (default) atau START-DATE (hanya kejadian yang dimulai dalam periode) — nilai dari pesan 422 GFW, fixture 24. */
  timeFilterMode?: "OVERLAP" | "START-DATE";
}): Promise<EventsPage> {
  assertDateRange(params.start, params.end);
  const offset = Math.max(0, Math.floor(params.offset ?? 0));
  const limit = Math.min(100, Math.max(1, Math.floor(params.limit ?? 25)));
  const alias = DATASETS[EVENT_KINDS[params.kind]].alias;
  const filters: Record<string, unknown> = {
    datasets: [alias],
    startDate: params.start,
    endDate: params.end,
  };
  if (params.vesselIds?.length) filters.vessels = params.vesselIds;
  if (params.portIds?.length) filters.portIds = params.portIds;
  if (params.timeFilterMode && params.timeFilterMode !== "OVERLAP") filters.timeFilterMode = params.timeFilterMode;
  const body = { ...filters, ...areaBody(params.area) };

  const key = cacheKey("events", alias, { ...filters, ...areaKey(params.area), offset, limit });
  const result = await cached(key, "events", alias, TTL.events, async () => {
    const res = await gfwRequest({
      method: "POST",
      path: "/v3/events",
      query: [
        ["offset", offset],
        ["limit", limit],
      ],
      body,
    });
    const page = eventsPageSchema.parse(res.json);
    const { events, rejected } = normalizeEvents(page.entries);
    const datasetResolved = page.metadata?.datasets?.find((d) => d.startsWith(alias.split(":")[0])) ?? null;
    recordDatasetSuccess(alias, datasetResolved);
    return {
      value: {
        events,
        rejected,
        total: page.total ?? null,
        offset,
        nextOffset: page.nextOffset ?? null,
        datasetRequested: alias,
        datasetResolved,
      },
    };
  });
  return { ...result.value, fetchedAt: result.fetchedAt, fromCache: result.fromCache };
}

export type EventStats = { numEvents: number | null; numVessels: number | null; numFlags: number | null; fetchedAt: string };

/**
 * POST /v3/events/stats (fixture 26–28). Body memakai startDate/endDate (dokumentasi menulis start-date/end-date,
 * yang ditolak 422). Tidak di-cache di sini; pemanggil (worker) menyimpan bersama snapshot.
 */
export async function fetchEventStats(params: {
  kind: EventKind;
  area: AreaRef;
  start: string;
  end: string;
  timeFilterMode?: "OVERLAP" | "START-DATE";
}): Promise<EventStats> {
  assertDateRange(params.start, params.end);
  const body: Record<string, unknown> = {
    datasets: [DATASETS[EVENT_KINDS[params.kind]].alias],
    startDate: params.start,
    endDate: params.end,
    ...areaBody(params.area),
    timeseriesInterval: "DAY",
    includes: ["TOTAL_COUNT"],
  };
  if (params.timeFilterMode && params.timeFilterMode !== "OVERLAP") body.timeFilterMode = params.timeFilterMode;
  const res = await gfwRequest({ method: "POST", path: "/v3/events/stats", body });
  const json = (res.json ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return { numEvents: num(json.numEvents), numVessels: num(json.numVessels), numFlags: num(json.numFlags), fetchedAt: new Date().toISOString() };
}

/** Satu batch event tanpa cache (untuk agregasi worker). limit 1000 terbukti diterima (fixture 25). */
export async function fetchEventsBatch(params: {
  kind: EventKind;
  area: AreaRef;
  start: string;
  end: string;
  offset: number;
  limit: number;
  timeFilterMode?: "OVERLAP" | "START-DATE";
  /** Filter GFW vessel ID (body `vessels`, fixture 16–18). */
  vesselIds?: string[];
  signal?: AbortSignal;
}) {
  const alias = DATASETS[EVENT_KINDS[params.kind]].alias;
  const body: Record<string, unknown> = {
    datasets: [alias],
    startDate: params.start,
    endDate: params.end,
    ...areaBody(params.area),
  };
  if (params.vesselIds?.length) body.vessels = params.vesselIds;
  if (params.timeFilterMode && params.timeFilterMode !== "OVERLAP") body.timeFilterMode = params.timeFilterMode;
  const res = await gfwRequest({
    method: "POST",
    path: "/v3/events",
    query: [
      ["offset", params.offset],
      ["limit", params.limit],
    ],
    body,
    timeoutMs: 90_000,
    signal: params.signal,
  });
  const page = eventsPageSchema.parse(res.json);
  const { events, rejected } = normalizeEvents(page.entries);
  const datasetResolved = page.metadata?.datasets?.find((d) => d.startsWith(alias.split(":")[0])) ?? null;
  return { events, rejected, total: page.total ?? null, nextOffset: page.nextOffset ?? null, datasetRequested: alias, datasetResolved };
}

// ---------------------------------------------------------------------------
// Vessels
// ---------------------------------------------------------------------------

const VESSEL_ID_RE = /^[0-9a-f][0-9a-f-]{8,63}$/i;

export function isValidVesselId(id: string): boolean {
  return VESSEL_ID_RE.test(id);
}

export async function searchVessels(params: { query: string; limit?: number; since?: string | null }) {
  const query = params.query.trim();
  if (query.length < 3 || query.length > 100) {
    throw new GfwError("INVALID_REQUEST", "Kata kunci pencarian 3–100 karakter.");
  }
  const limit = Math.min(50, Math.max(1, Math.floor(params.limit ?? 20)));
  const alias = DATASETS.vesselIdentity.alias;
  const requestQuery: Array<[string, string | number]> = [
    ["query", query],
    ["datasets[0]", alias],
    ["limit", limit],
  ];
  if (params.since) requestQuery.push(["since", params.since]);

  const key = cacheKey("vessel-search", alias, { query, limit, since: params.since ?? null });
  const result = await cached(key, "vessel-search", alias, TTL.identity, async () => {
    const res = await gfwRequest({ path: "/v3/vessels/search", query: requestQuery });
    const page = vesselSearchSchema.parse(res.json);
    const candidates: VesselIdentity[] = [];
    let rejected = 0;
    for (const entry of page.entries) {
      const parsed = vesselIdentitySchema.safeParse(entry);
      if (parsed.success) candidates.push(parsed.data);
      else rejected += 1;
    }
    const datasetResolved = resolvedVersionFromHeader(res.headers["x-datasets"], alias);
    recordDatasetSuccess(alias, datasetResolved);
    return { value: { candidates, rejected, total: page.total ?? null, since: page.since ?? null, datasetResolved } };
  });
  return { ...result.value, fetchedAt: result.fetchedAt, fromCache: result.fromCache };
}

export async function getVessel(id: string) {
  if (!isValidVesselId(id)) throw new GfwError("INVALID_REQUEST", "ID kapal tidak valid.");
  const alias = DATASETS.vesselIdentity.alias;
  const key = cacheKey("vessel", alias, { id });
  const result = await cached(key, "vessel", alias, TTL.identity, async () => {
    const res = await gfwRequest({ path: `/v3/vessels/${encodeURIComponent(id)}`, query: [["dataset", alias]] });
    const identity = vesselIdentitySchema.parse(res.json);
    const datasetResolved = resolvedVersionFromHeader(res.headers["x-datasets"], alias) ?? identity.dataset;
    recordDatasetSuccess(alias, datasetResolved);
    return { value: { identity, datasetResolved } };
  });
  return { ...result.value, fetchedAt: result.fetchedAt, fromCache: result.fromCache };
}

// ---------------------------------------------------------------------------
// 4Wings report (dipanggil dari worker pada Tahap 3; satu report per akun pada satu waktu)
// ---------------------------------------------------------------------------

export const REPORT_DATASETS = {
  fishingEffort: { key: "fishingEffort", metric: "hours" },
  presence: { key: "presence", metric: "hours" },
  sar: { key: "sar", metric: "detections" },
} as const satisfies Record<string, { key: DatasetKey; metric: ReportMetric }>;
export type ReportDatasetKey = keyof typeof REPORT_DATASETS;

export type RegionReportParams = {
  dataset: ReportDatasetKey;
  area: AreaRef;
  start: string;
  end: string;
  temporalResolution: "DAILY" | "MONTHLY" | "ENTIRE";
  /** Terbukti diterima: FLAG. Nilai lain dari dokumentasi belum diuji. */
  groupBy: "FLAG" | "GEARTYPE" | "VESSEL_ID";
  spatialAggregation: boolean;
  signal?: AbortSignal;
};

export type RegionReportResult = NormalizedReport & {
  datasetRequested: string;
  fetchedAt: string;
};

/** Query report kanonik; dipakai untuk request dan untuk hash pencatatan lock (harus identik). */
export function buildReportQuery(params: Omit<RegionReportParams, "signal">): Array<[string, string | number]> {
  const alias = DATASETS[REPORT_DATASETS[params.dataset].key].alias;
  const query: Array<[string, string | number]> = [
    ["datasets[0]", alias],
    ["format", "JSON"],
    ["group-by", params.groupBy],
    ["temporal-resolution", params.temporalResolution],
    ["spatial-aggregation", String(params.spatialAggregation)],
    ["date-range", `${params.start},${params.end}`],
  ];
  if ("region" in params.area) query.push(["region-dataset", params.area.region.dataset], ["region-id", params.area.region.id]);
  if (!params.spatialAggregation) query.push(["spatial-resolution", "LOW"]);
  return query;
}

/** Identitas permintaan untuk lock/pemulihan: query + hash poligon (poligon dikirim di body, tidak di query). */
export function reportIdentity(params: Omit<RegionReportParams, "signal">): Array<[string, string | number]> {
  const query = buildReportQuery(params);
  return "region" in params.area ? query : [...query, ["geometry-hash", params.area.geometryHash]];
}

/** Normalisasi JSON report (dari report langsung maupun last-report) menjadi hasil standar. */
export function normalizeReportResponse(
  json: unknown,
  dataset: ReportDatasetKey,
  xDatasetsHeader: string | undefined,
): RegionReportResult {
  const def = REPORT_DATASETS[dataset];
  const alias = DATASETS[def.key].alias;
  const report = normalizeReport(json, def.metric);
  const datasetResolved = resolvedVersionFromHeader(xDatasetsHeader, alias) ?? report.datasetResolved;
  recordDatasetSuccess(alias, datasetResolved);
  return { ...report, datasetResolved, datasetRequested: alias, fetchedAt: new Date().toISOString() };
}

/** Tanpa cache di sini: worker menyimpan hasil sebagai snapshot immutable (report_results). */
export async function runRegionReport(params: RegionReportParams): Promise<RegionReportResult> {
  assertDateRange(params.start, params.end, 366);
  const res = await gfwRequest({
    // Poligon sendiri hanya lewat POST body `geojson` (dokumentasi 4Wings report; fixture 32).
    ...("region" in params.area
      ? {}
      : {
          method: "POST" as const,
          body: { geojson: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: params.area.geometry }] } },
        }),
    path: "/v3/4wings/report",
    query: buildReportQuery(params),
    timeoutMs: 120_000,
    maxRetries: 0,
    signal: params.signal,
  });
  return normalizeReportResponse(res.json, params.dataset, res.headers["x-datasets"]);
}

export type LastReportState =
  | { state: "running"; uri: string | null }
  | { state: "finished"; json: unknown; xDatasets: string | undefined }
  | { state: "failed"; detail: string | null }
  | { state: "not_found" };

/**
 * GET /v3/4wings/last-report (dokumentasi + fixture 13): menyimpan report terakhir akun selama 30 menit.
 * Respons selesai identik dengan report asli dan TIDAK memuat penanda report — pemanggil wajib memastikan
 * report terakhir akun memang miliknya (lihat lock `gfw-report`).
 */
export async function fetchLastReport(signal?: AbortSignal): Promise<LastReportState> {
  try {
    const res = await gfwRequest({ path: "/v3/4wings/last-report", maxRetries: 1, timeoutMs: 120_000, signal });
    const json = res.json as Record<string, unknown> | null;
    if (json && json.status === "running") return { state: "running", uri: typeof json.uri === "string" ? json.uri : null };
    if (json && Array.isArray(json.entries)) return { state: "finished", json, xDatasets: res.headers["x-datasets"] };
    if (json && typeof json.status === "number") {
      const message = json.message as { error?: unknown } | undefined;
      return { state: "failed", detail: typeof message?.error === "string" ? message.error : `status ${json.status}` };
    }
    return { state: "failed", detail: "Bentuk respons last-report tidak dikenali." };
  } catch (error) {
    if (error instanceof GfwError && error.code === "NOT_FOUND") return { state: "not_found" };
    throw error;
  }
}
