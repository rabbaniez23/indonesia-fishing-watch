/**
 * Filter periode (PRD §6.2, FR-02). Semua tanggal adalah hari UTC.
 * UI memakai rentang inklusif (from..to); report GFW memakai end eksklusif (end = to + 1 hari).
 */

export const DEFAULT_DAYS = 30;
/** Buffer desain awal: periode default berakhir 5 hari sebelum hari ini (bukan jaminan lengkap). */
export const DEFAULT_END_OFFSET_DAYS = 5;
export const MAX_DAYS = 90;
const DAY = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return toDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY));
}

export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

function isValidDay(value: string): boolean {
  return DATE_RE.test(value) && toDay(new Date(`${value}T00:00:00Z`)) === value;
}

export type PeriodFilter = {
  regionId: string;
  /** Inklusif. */
  from: string;
  to: string;
  /** Untuk report: start = from, end = to + 1 hari (eksklusif). */
  start: string;
  end: string;
  days: number;
};

export function todayUtc(now: Date = new Date()): string {
  return toDay(now);
}

export function defaultFilter(regionId: string, now: Date = new Date()): PeriodFilter {
  const end = addDays(todayUtc(now), -DEFAULT_END_OFFSET_DAYS);
  const start = addDays(end, -DEFAULT_DAYS);
  return { regionId, from: start, to: addDays(end, -1), start, end, days: DEFAULT_DAYS };
}

export type FilterValidation = { ok: true; filter: PeriodFilter } | { ok: false; error: string };

/** Validasi input filter. Tanggal terbalik / rentang terlalu panjang / masa depan ditolak (FR-02). */
export function validateFilter(
  input: { regionId: string; from: string; to: string },
  now: Date = new Date(),
  maxDays: number = MAX_DAYS,
): FilterValidation {
  const { regionId, from, to } = input;
  if (!isValidDay(from) || !isValidDay(to)) return { ok: false, error: "Tanggal harus berformat YYYY-MM-DD (hari UTC)." };
  if (to < from) return { ok: false, error: "Tanggal akhir tidak boleh sebelum tanggal mulai." };
  const days = dayDiff(from, to) + 1;
  if (days > maxDays) return { ok: false, error: `Rentang maksimal ${maxDays} hari.` };
  if (to >= todayUtc(now)) return { ok: false, error: "Tanggal akhir harus sebelum hari ini (UTC)." };
  return { ok: true, filter: { regionId, from, to, start: from, end: addDays(to, 1), days } };
}

/** Baca filter dari URL; nilai tidak valid jatuh ke default dengan pesan. */
export function parseFilter(
  params: Record<string, string | string[] | undefined>,
  allowedRegions: string[],
  now: Date = new Date(),
  maxDays: number = MAX_DAYS,
): { filter: PeriodFilter; error: string | null } {
  const fallbackRegion = allowedRegions[0] ?? "";
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const regionParam = pick("region");
  const regionId = regionParam && allowedRegions.includes(regionParam) ? regionParam : fallbackRegion;
  const from = pick("from");
  const to = pick("to");
  if (!from && !to) {
    return {
      filter: defaultFilter(regionId, now),
      error: regionParam && regionParam !== regionId ? "Wilayah pada tautan tidak tervalidasi; memakai wilayah default." : null,
    };
  }
  const result = validateFilter({ regionId, from: from ?? "", to: to ?? "" }, now, maxDays);
  if (result.ok) return { filter: result.filter, error: null };
  return { filter: defaultFilter(regionId, now), error: `${result.error} Menampilkan periode default.` };
}

/** Periode pembanding: panjang sama, tepat sebelum periode aktif (FR-04). */
export function previousPeriod(filter: PeriodFilter): PeriodFilter {
  const start = addDays(filter.start, -filter.days);
  return { ...filter, start, end: filter.start, from: start, to: addDays(filter.start, -1) };
}

/** Hari terakhir periode masuk rentang keterlambatan data menurut dokumentasi (≤ 5 hari). */
export function overlapsRecentDelay(filter: PeriodFilter, now: Date = new Date()): boolean {
  return dayDiff(filter.to, todayUtc(now)) <= DEFAULT_END_OFFSET_DAYS;
}
