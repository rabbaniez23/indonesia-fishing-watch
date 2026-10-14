import type { RadianceClass } from "./types";

/**
 * Warna kelas radiansi: tiga slot pertama palet kategorikal referensi (biru, oranye, hijau-toska) —
 * lolos validasi all-pairs di permukaan putih (CVD ΔE 9,2; normal ΔE 24). Hijau-toska < 3:1 terhadap
 * putih, jadi setiap grafik kelas memberi label langsung + tabel setara.
 */
export const CLASS_COLOR: Record<RadianceClass, string> = { low: "#2a78d6", medium: "#eb6834", high: "#1baf7a" };
export const CLASS_LABEL: Record<RadianceClass, string> = { low: "Rendah", medium: "Sedang", high: "Tinggi" };
export const CLASS_RULE: Record<RadianceClass, string> = { low: "< 10", medium: "10–400", high: "> 400" };
export const RADIANCE_UNIT = "nW/cm²/sr";

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const MONTH_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const oneDecimal = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimal = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const threeDecimal = new Intl.NumberFormat("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

const ok = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Porsi (bukan perubahan): tanpa tanda +, satu desimal. */
export const fmtShare = (v: number | null | undefined) => (ok(v) ? `${oneDecimal.format(v)}%` : "—");
export const fmt1 = (v: number | null | undefined) => (ok(v) ? oneDecimal.format(v) : "—");
export const fmt2 = (v: number | null | undefined) => (ok(v) ? twoDecimal.format(v) : "—");
export const fmt3 = (v: number | null | undefined) => (ok(v) ? threeDecimal.format(v) : "—");
export const fmtCompact = (v: number | null | undefined) => (ok(v) ? compact.format(v) : "—");
/** Nilai bertanda eksplisit (Sen's slope, statistik DM). */
export const fmtSigned = (v: number | null | undefined, digits = 1) =>
  ok(v)
    ? `${v > 0 ? "+" : v < 0 ? "−" : ""}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(v))}`
    : "—";
export const fmtP = (v: number | null | undefined) => (ok(v) ? (v < 0.001 ? "< 0,001" : threeDecimal.format(v)) : "—");

/** "2025-03" → "Mar 2025". */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]} ${y}`;
}

/** "2012-04-01" → "1 April 2012". */
export function longDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTH_LONG[m - 1]} ${y}`;
}
