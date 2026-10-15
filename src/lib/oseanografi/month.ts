import { MONTH_LONG, monthLabel } from "./format";
import type { OceanVarMeta } from "./types";

/** Pemetaan filter periode menu Peta → bingkai grid oseanografi (lapisan laut). */

/** Bulan (YYYY-MM) yang paling banyak harinya di dalam periode filter [from, to] (inklusif); seri → yang lebih awal. */
export function dominantMonth(from: string, to: string): string {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return from.slice(0, 7);
  const days = new Map<string, number>();
  for (let t = start; t <= end; t += 86_400_000) {
    const ym = new Date(t).toISOString().slice(0, 7);
    days.set(ym, (days.get(ym) ?? 0) + 1);
  }
  let best = from.slice(0, 7);
  let most = 0;
  for (const [ym, n] of days) {
    if (n > most) {
      best = ym;
      most = n;
    }
  }
  return best;
}

/** Bingkai grid ("1".."12" atau "latest") dan keterangannya untuk bulan filter. */
export function oceanFrame(v: OceanVarMeta, latestMonth: string | null, ym: string): { frame: string; label: string } {
  const m = Number(ym.slice(5, 7));
  const month = MONTH_LONG[m - 1];
  if (latestMonth && latestMonth === ym) return { frame: "latest", label: `${monthLabel(ym)} (data bulan itu)` };
  if (v.kind === "year") return { frame: String(m), label: `${month} ${v.period.year} (contoh satu tahun)` };
  if (v.kind === "climatology") return { frame: String(m), label: `${month} · klimatologi model` };
  return { frame: String(m), label: `${month} · rata-rata ${v.period.climatology?.join("–") ?? ""}` };
}
