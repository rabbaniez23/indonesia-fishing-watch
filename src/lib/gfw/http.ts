import { getDb } from "@/lib/db";
import { BUDGET_KEY, getSetting } from "@/lib/settings";

/**
 * Klien HTTP generik untuk GFW REST API (PRD §11.3). Tidak mengasumsikan bentuk respons;
 * schema per endpoint ditulis terpisah setelah contract check.
 *
 * Aturan:
 * - Token hanya dari env server `GFW_API_ACCESS_TOKEN`; tidak pernah dicatat, dikembalikan, atau masuk URL.
 * - Timeout + AbortController di setiap request.
 * - Retry terbatas hanya untuk kegagalan sementara (jaringan, 500/502/503/504). 401/403/422/429/524 tidak di-retry.
 * - Setiap percobaan upstream dihitung ke budget harian (hari UTC).
 */

export const GFW_BASE_URL = "https://gateway.api.globalfishingwatch.org";
export const DEFAULT_DAILY_BUDGET = 5000;

export type GfwErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_REQUEST"
  | "RATE_LIMITED"
  | "REPORT_IN_PROGRESS"
  | "REPORT_TIMEOUT"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "NETWORK"
  | "BUDGET_EXCEEDED";

export class GfwError extends Error {
  constructor(
    public readonly code: GfwErrorCode,
    message: string,
    public readonly status: number | null = null,
    public readonly retryable = false,
    /** Ringkasan error upstream tersanitasi (judul/detail), untuk Admin saja. */
    public readonly detail: string | null = null,
    /** Metadata upstream yang aman, mis. info report yang sedang berjalan saat 429. */
    public readonly upstreamMetadata: unknown = null,
  ) {
    super(message);
  }
}

export type QueryValue = string | number | boolean;
/** Pasangan [nama, nilai] agar encoding array (`datasets[0]` vs `datasets` berulang) eksplisit per endpoint. */
export type QueryPairs = Array<[string, QueryValue]>;

export type GfwRequest = {
  path: string;
  method?: "GET" | "POST";
  query?: QueryPairs;
  body?: unknown;
  timeoutMs?: number;
  maxRetries?: number;
  signal?: AbortSignal;
};

export type GfwResponse = {
  status: number;
  url: string;
  /** Subset header yang relevan (tanpa header sensitif). */
  headers: Record<string, string>;
  contentType: string;
  json: unknown | null;
  bytes: Uint8Array | null;
};

const SAFE_HEADERS = [
  "content-type",
  "content-disposition",
  "x-datasets",
  "retry-after",
  "x-ratelimit-daily-remaining-requests",
  "x-ratelimit-monthly-remaining-requests",
  "x-ratelimit-daily-limit",
  "x-ratelimit-monthly-limit",
];

function getToken(): string {
  const token = process.env.GFW_API_ACCESS_TOKEN;
  if (!token) throw new GfwError("NOT_CONFIGURED", "Token GFW belum dipasang di server.");
  return token;
}

export function buildUrl(path: string, query: QueryPairs = []): string {
  const url = new URL(path, GFW_BASE_URL);
  for (const [key, value] of query) url.searchParams.append(key, String(value));
  return url.toString();
}

function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Budget harian: pengaturan Admin (app_settings) → env GFW_DAILY_BUDGET → default 5.000. */
export function dailyBudget(): number {
  const fromSettings = Number(getSetting(BUDGET_KEY));
  if (Number.isFinite(fromSettings) && fromSettings > 0) return fromSettings;
  const configured = Number(process.env.GFW_DAILY_BUDGET);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_DAILY_BUDGET;
}

/** Ambil satu slot budget upstream; lempar BUDGET_EXCEEDED bila habis. */
export function consumeBudget(): void {
  const db = getDb();
  const day = utcDay();
  db.prepare("INSERT INTO budget_counters (day) VALUES (?) ON CONFLICT(day) DO NOTHING").run(day);
  const result = db
    .prepare("UPDATE budget_counters SET upstream_requests = upstream_requests + 1 WHERE day = ? AND upstream_requests < ?")
    .run(day, dailyBudget());
  if (Number(result.changes) === 0) {
    throw new GfwError("BUDGET_EXCEEDED", "Budget request harian aplikasi sudah habis.");
  }
}

export function recordCacheHit(): void {
  getDb()
    .prepare(
      "INSERT INTO budget_counters (day, cache_hits) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET cache_hits = cache_hits + 1",
    )
    .run(utcDay());
}

export function budgetToday(): { day: string; upstreamRequests: number; cacheHits: number; limit: number } {
  const day = utcDay();
  const row = getDb().prepare("SELECT upstream_requests, cache_hits FROM budget_counters WHERE day = ?").get(day) as
    | { upstream_requests: number; cache_hits: number }
    | undefined;
  return { day, upstreamRequests: row?.upstream_requests ?? 0, cacheHits: row?.cache_hits ?? 0, limit: dailyBudget() };
}

/** Ringkas body error GFW ({ error, messages: [{title, detail}], statusCode }) tanpa menyalin seluruh body. */
function summarizeErrorBody(json: unknown): { detail: string | null; metadata: unknown } {
  if (!json || typeof json !== "object") return { detail: null, metadata: null };
  const body = json as { error?: unknown; messages?: unknown };
  const parts: string[] = [];
  if (typeof body.error === "string") parts.push(body.error);
  let metadata: unknown = null;
  if (Array.isArray(body.messages)) {
    for (const message of body.messages.slice(0, 3)) {
      if (message && typeof message === "object") {
        const m = message as { title?: unknown; detail?: unknown; metadata?: unknown };
        if (typeof m.title === "string") parts.push(m.title);
        if (typeof m.detail === "string") parts.push(m.detail);
        if (m.metadata && !metadata) metadata = m.metadata;
      }
    }
  }
  const detail = parts.join(" — ").slice(0, 500) || null;
  return { detail, metadata };
}

function classify(status: number, detail: string | null, metadata: unknown): GfwError {
  switch (status) {
    case 401:
      return new GfwError("UNAUTHENTICATED", "Token GFW ditolak (401).", status, false, detail);
    case 403:
      return new GfwError("FORBIDDEN", "Token GFW tidak memiliki akses ke sumber ini (403).", status, false, detail);
    case 404:
      return new GfwError("NOT_FOUND", "Sumber tidak ditemukan di GFW (404).", status, false, detail);
    case 422:
    case 400:
      return new GfwError("INVALID_REQUEST", "Permintaan tidak sesuai kontrak GFW.", status, false, detail);
    case 429: {
      const hasReport =
        !!metadata && typeof metadata === "object" && ("currentReportUrl" in metadata || "currentReportBody" in metadata);
      return hasReport
        ? new GfwError("REPORT_IN_PROGRESS", "Masih ada report GFW yang berjalan untuk akun ini.", status, false, detail, metadata)
        : new GfwError("RATE_LIMITED", "Batas request GFW tercapai (429).", status, false, detail);
    }
    case 524:
      return new GfwError("REPORT_TIMEOUT", "Report GFW melewati batas waktu gateway (524).", status, false, detail);
    default:
      return new GfwError("UPSTREAM_ERROR", `GFW mengembalikan status ${status}.`, status, status >= 500, detail);
  }
}

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

export async function gfwRequest(request: GfwRequest): Promise<GfwResponse> {
  const token = getToken();
  const url = buildUrl(request.path, request.query);
  const maxRetries = request.maxRetries ?? 2;
  const timeoutMs = request.timeoutMs ?? 30_000;

  for (let attempt = 0; ; attempt++) {
    consumeBudget();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
    const onAbort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener("abort", onAbort);

    let response: Response;
    try {
      response = await fetch(url, {
        method: request.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json, application/zip, */*",
          ...(request.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
      if (request.signal?.aborted) throw error;
      const timedOut = controller.signal.aborted;
      if (attempt < maxRetries) {
        await sleep(500 * 2 ** attempt + Math.random() * 250, request.signal);
        continue;
      }
      throw new GfwError(
        timedOut ? "TIMEOUT" : "NETWORK",
        timedOut ? "Request GFW melewati batas waktu." : "Tidak dapat menghubungi GFW.",
        null,
        true,
      );
    }

    const headers: Record<string, string> = {};
    for (const name of SAFE_HEADERS) {
      const value = response.headers.get(name);
      if (value !== null) headers[name] = value;
    }
    const contentType = headers["content-type"] ?? "";
    let json: unknown | null = null;
    let bytes: Uint8Array | null = null;
    try {
      if (contentType.includes("json")) json = await response.json();
      else bytes = new Uint8Array(await response.arrayBuffer());
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
    }

    if (response.ok) return { status: response.status, url: redactUrl(url), headers, contentType, json, bytes };

    if (RETRYABLE_STATUS.has(response.status) && attempt < maxRetries) {
      await sleep(500 * 2 ** attempt + Math.random() * 250, request.signal);
      continue;
    }
    const { detail, metadata } = summarizeErrorBody(json);
    throw classify(response.status, detail, metadata);
  }
}

/** URL GFW tidak memuat token; fungsi ini menjaga agar tetap demikian bila suatu saat ada query sensitif. */
function redactUrl(url: string): string {
  const parsed = new URL(url);
  for (const key of ["token", "access_token", "key"]) parsed.searchParams.delete(key);
  return parsed.toString();
}
