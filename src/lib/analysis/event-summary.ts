import "server-only";
import { areaKey, EVENT_KINDS, fetchEventStats, type AreaRef, type EventKind } from "@/lib/gfw/adapters";
import { cached, cacheKey, TTL } from "@/lib/gfw/cache";
import { DATASETS } from "@/lib/gfw/capabilities";

/**
 * Ringkasan kejadian per jenis lewat POST /v3/events/stats (fixture 35: keempat jenis menerima body yang sama;
 * respons hanya memuat numEvents, numVessels, numFlags, flags — tanpa deret waktu). Di-cache 6 jam per wilayah+periode.
 */

export const EVENT_SUMMARY_KINDS: EventKind[] = ["fishing", "encounter", "loitering", "port_visit"];

export type EventKindSummary = {
  kind: EventKind;
  numEvents: number | null;
  numVessels: number | null;
  numFlags: number | null;
  fetchedAt: string | null;
  error: string | null;
};

async function cachedStats(kind: EventKind, area: AreaRef, start: string, end: string): Promise<EventKindSummary> {
  const alias = DATASETS[EVENT_KINDS[kind]].alias;
  const key = cacheKey("event-stats", alias, { ...areaKey(area), start, end });
  try {
    const hit = await cached(key, "events", alias, TTL.events, async () => {
      const s = await fetchEventStats({ kind, area, start, end });
      return { value: { numEvents: s.numEvents, numVessels: s.numVessels, numFlags: s.numFlags } };
    });
    return { kind, ...hit.value, fetchedAt: hit.fetchedAt, error: null };
  } catch (e) {
    return { kind, numEvents: null, numVessels: null, numFlags: null, fetchedAt: null, error: (e as { code?: string }).code ?? "GAGAL" };
  }
}

/** Ringkasan semua jenis untuk satu periode. Request dijalankan berurutan agar tidak membebani kuota. */
export async function loadEventSummary(area: AreaRef, start: string, end: string): Promise<EventKindSummary[]> {
  const out: EventKindSummary[] = [];
  for (const kind of EVENT_SUMMARY_KINDS) out.push(await cachedStats(kind, area, start, end));
  return out;
}
