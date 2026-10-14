import { createHash } from "node:crypto";
import { getDb, nowIso } from "@/lib/db";
import { recordCacheHit } from "./http";

/**
 * Cache respons upstream ternormalisasi (PRD §11.5). TTL adalah kebijakan aplikasi,
 * bukan jadwal pembaruan provider.
 */
export const TTL = {
  identity: 24 * 3_600_000,
  events: 6 * 3_600_000,
  analysis: 6 * 3_600_000,
  regions: 24 * 3_600_000,
} as const;

/** Bump bila logika normalisasi berubah agar cache lama tidak dipakai. */
export const NORMALIZER_VERSION = "1";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** Key: family + dataset + filter kanonik + versi normalizer, di-hash (tanpa data sensitif). */
export function cacheKey(family: string, dataset: string | null, params: Record<string, unknown>): string {
  const material = JSON.stringify(canonical({ family, dataset, params, normalizer: NORMALIZER_VERSION }));
  return `${family}:${createHash("sha256").update(material).digest("hex")}`;
}

export type CacheHit<T> = { value: T; fetchedAt: string; meta: Record<string, unknown> | null };

export function readCache<T>(key: string, now: Date = new Date()): CacheHit<T> | null {
  const row = getDb()
    .prepare("SELECT body_json, meta_json, fetched_at, expires_at FROM cache_entries WHERE key = ?")
    .get(key) as { body_json: string; meta_json: string | null; fetched_at: string; expires_at: string } | undefined;
  if (!row || Date.parse(row.expires_at) <= now.getTime()) return null;
  return {
    value: JSON.parse(row.body_json) as T,
    fetchedAt: row.fetched_at,
    meta: row.meta_json ? (JSON.parse(row.meta_json) as Record<string, unknown>) : null,
  };
}

/** Cache yang sudah kedaluwarsa tetap boleh dipakai sebagai "stale" dengan label (FR-12). */
export function readStaleCache<T>(key: string): CacheHit<T> | null {
  const row = getDb().prepare("SELECT body_json, meta_json, fetched_at FROM cache_entries WHERE key = ?").get(key) as
    | { body_json: string; meta_json: string | null; fetched_at: string }
    | undefined;
  if (!row) return null;
  return {
    value: JSON.parse(row.body_json) as T,
    fetchedAt: row.fetched_at,
    meta: row.meta_json ? (JSON.parse(row.meta_json) as Record<string, unknown>) : null,
  };
}

export function writeCache(
  key: string,
  family: string,
  dataset: string | null,
  value: unknown,
  ttlMs: number,
  meta: Record<string, unknown> | null = null,
  now: Date = new Date(),
): string {
  const fetchedAt = nowIso(now);
  getDb()
    .prepare(
      `INSERT INTO cache_entries (key, family, dataset, body_json, meta_json, fetched_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET body_json = excluded.body_json, meta_json = excluded.meta_json,
         fetched_at = excluded.fetched_at, expires_at = excluded.expires_at, dataset = excluded.dataset`,
    )
    .run(key, family, dataset, JSON.stringify(value), meta ? JSON.stringify(meta) : null, fetchedAt, nowIso(new Date(now.getTime() + ttlMs)));
  return fetchedAt;
}

/** Request yang sedang berjalan dengan key sama digabung (request coalescing, PRD §11.3). */
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  family: string,
  dataset: string | null,
  ttlMs: number,
  fetcher: () => Promise<{ value: T; meta?: Record<string, unknown> }>,
): Promise<CacheHit<T> & { fromCache: boolean }> {
  const hit = readCache<T>(key);
  if (hit) {
    recordCacheHit();
    return { ...hit, fromCache: true };
  }
  const running = inflight.get(key) as Promise<CacheHit<T> & { fromCache: boolean }> | undefined;
  if (running) return running;
  const promise = (async () => {
    const { value, meta = null } = await fetcher();
    const fetchedAt = writeCache(key, family, dataset, value, ttlMs, meta);
    return { value, fetchedAt, meta, fromCache: false };
  })().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
