/**
 * Format tampilan Indonesia (Design System §4):
 * pemisah ribuan titik, desimal koma, timestamp selalu menyebut UTC.
 * Nilai null/undefined berarti "tidak diketahui" — tidak pernah diubah menjadi 0.
 */

const LOCALE = "id-ID";

const integerFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const oneDecimalFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export const EMPTY_VALUE = "—";

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Jumlah diskret (deteksi, kejadian, ID kapal): integer. */
export function formatCount(value: number | null | undefined): string {
  return isFiniteNumber(value) ? integerFormat.format(value) : EMPTY_VALUE;
}

/** Jam agregat: maksimal satu desimal. */
export function formatHours(value: number | null | undefined): string {
  return isFiniteNumber(value) ? oneDecimalFormat.format(value) : EMPTY_VALUE;
}

/** Persentase perubahan dengan tanda eksplisit, satu desimal. */
export function formatPercent(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return EMPTY_VALUE;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${oneDecimalFormat.format(Math.abs(value))}%`;
}

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Tanggal hari UTC, mis. "13 Okt 2026". */
export function formatDateUTC(value: string | Date | null | undefined): string {
  if (!value) return EMPTY_VALUE;
  const date = toDate(value);
  return date ? dateFormat.format(date) : EMPTY_VALUE;
}

/** Tanggal dan jam dengan label UTC, mis. "13 Okt 2026, 08.30 UTC". */
export function formatDateTimeUTC(value: string | Date | null | undefined): string {
  if (!value) return EMPTY_VALUE;
  const date = toDate(value);
  return date ? `${dateTimeFormat.format(date)} UTC` : EMPTY_VALUE;
}

/** Rentang hari UTC, mis. "1 Sep 2026 – 30 Sep 2026 (hari UTC)". */
export function formatDateRangeUTC(start: string | Date, end: string | Date): string {
  return `${formatDateUTC(start)} – ${formatDateUTC(end)} (hari UTC)`;
}

const coordFormat = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 4 });

/** Koordinat titik sel/kejadian, mis. "7,2° LS · 112,7° BT". */
export function formatLatLon(lat: number, lon: number): string {
  const ns = lat < 0 ? "LS" : "LU";
  const ew = lon < 0 ? "BB" : "BT";
  return `${coordFormat.format(Math.abs(lat))}° ${ns} · ${coordFormat.format(Math.abs(lon))}° ${ew}`;
}

/** Durasi dari jam desimal, mis. "20 jam" atau "6 hari 23 jam". null → tanda kosong. */
export function formatDuration(hours: number | null | undefined): string {
  if (!isFiniteNumber(hours) || hours < 0) return EMPTY_VALUE;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} menit`;
  if (hours < 48) return `${oneDecimalFormat.format(hours)} jam`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours - days * 24);
  return rest > 0 ? `${integerFormat.format(days)} hari ${rest} jam` : `${integerFormat.format(days)} hari`;
}
