"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { LineChart } from "@/components/viirs/LineChart";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { GROUP_LABEL, MONTH_LONG, MONTH_SHORT, VAR_STYLE, fmtNum, fmtP, fmtSignedNum, fmtVar, monthLabel, rampColor, type OceanGroup } from "@/lib/oseanografi/format";
import type { OceanLink, OceanSeasonal, OceanSeries, OceanTrends, OceanVarKey, OceanVarMeta } from "@/lib/oseanografi/types";

/** Variabel bawaan bila tersedia; jika tidak, variabel pertama. */
function pick(variables: OceanVarMeta[], preferred: OceanVarKey): OceanVarKey {
  return variables.some((v) => v.key === preferred) ? preferred : variables[0].key;
}

const AREA_LABEL = (k: string) => (k === "total" ? "Semua WPP" : `WPP ${k}`);

function Chips({ options, value, onChange, label }: { options: Array<{ key: string; label: string }>; value: string; onChange: (k: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
          className={cn(
            "inline-flex h-9 items-center rounded-full border px-3 transition-colors duration-150",
            o.key === value ? "border-primary bg-primary-soft font-semibold text-primary" : "border-border-control bg-surface text-ink hover:bg-surface-subtle",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pemilih variabel dikelompokkan (fisika/biologi/kimia/atmosfer). */
function VarPicker({ variables, value, onChange }: { variables: OceanVarMeta[]; value: OceanVarKey; onChange: (k: OceanVarKey) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {(Object.keys(GROUP_LABEL) as OceanGroup[]).map((g) => {
        const items = variables.filter((v) => VAR_STYLE[v.key].group === g);
        if (!items.length) return null;
        return (
          <div key={g} className="flex flex-wrap items-center gap-2">
            <span className="w-full text-caption font-medium text-ink-muted sm:w-36">{GROUP_LABEL[g]}</span>
            <Chips label={`Variabel ${GROUP_LABEL[g]}`} value={value} onChange={(k) => onChange(k as OceanVarKey)} options={items.map((v) => ({ key: v.key, label: v.label }))} />
          </div>
        );
      })}
    </div>
  );
}

function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className="font-medium text-primary underline underline-offset-2">
        {open ? "Sembunyikan tabel" : "Lihat tabel"}
      </button>
    </div>
  );
}

/** Pola musiman: heatmap wilayah × bulan dengan skala warna bersama, puncak ditandai titik. */
export function SeasonalSection({ variables, seasonal, areas }: { variables: OceanVarMeta[]; seasonal: OceanSeasonal; areas: string[] }) {
  const [key, setKey] = useState<OceanVarKey>(() => pick(variables, "sst"));
  const [active, setActive] = useState<{ a: string; m: number } | null>(null);
  const [showTable, setShowTable] = useState(false);
  const meta = variables.find((v) => v.key === key)!;
  const data = seasonal[key] ?? {};
  const rows = ["total", ...areas].filter((a) => data[a]);
  const all = rows.flatMap((a) => data[a].mean.filter((v): v is number => v !== null));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const ramp = VAR_STYLE[key].ramp;
  const color = (v: number) => {
    const t = meta.log ? (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo) || 1) : (v - lo) / (hi - lo || 1);
    const [r, g, b] = rampColor(ramp, t);
    return `rgb(${r},${g},${b})`;
  };
  const activeVal = active ? data[active.a]?.mean[active.m] : null;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <VarPicker variables={variables} value={key} onChange={setKey} />
      <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label={`Pola musiman ${meta.label} per WPP; tabel setara tersedia.`}>
        <table className="w-full min-w-[620px] border-separate border-spacing-[2px] text-caption" aria-hidden>
          <thead>
            <tr>
              <th className="w-[6rem]" />
              {MONTH_SHORT.map((m) => (
                <th key={m} className="font-medium text-ink-muted">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a}>
                <th scope="row" className={cn("pr-2 text-left whitespace-nowrap text-ink", a === "total" ? "font-semibold" : "font-medium")}>
                  {AREA_LABEL(a)}
                </th>
                {data[a].mean.map((v, m) => (
                  <td
                    key={m}
                    onPointerEnter={() => setActive({ a, m })}
                    onPointerLeave={() => setActive(null)}
                    className={cn("relative h-8 rounded-[4px]", active?.a === a && active.m === m && "outline-2 outline-ink")}
                    style={{ background: v === null ? "var(--color-surface-subtle)" : color(v) }}
                  >
                    {data[a].peak === m + 1 ? <span aria-hidden className="absolute top-1/2 left-1/2 size-2 -translate-1/2 rounded-full border border-white bg-[#172b22]" /> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-caption text-ink-muted">
          <span className="tabular">{fmtVar(key, lo)}</span>
          <span aria-hidden className="h-3 w-40 rounded-[3px]" style={{ background: `linear-gradient(90deg, ${ramp.join(", ")})` }} />
          <span className="tabular">{fmtVar(key, hi)}</span>
          <span>{meta.unit}</span>
          <span>· ● = bulan puncak</span>
        </div>
        <p role="status" aria-live="polite" className="min-h-5 text-caption text-ink">
          {active && activeVal != null ? (
            <>
              <span className="font-semibold">{AREA_LABEL(active.a)}</span> · {MONTH_LONG[active.m]}: <span className="tabular">{fmtVar(key, activeVal)}</span> {meta.unit}
            </>
          ) : (
            <span className="text-ink-muted">Arahkan kursor ke sel untuk melihat nilai.</span>
          )}
        </p>
      </div>
      <p className="text-caption text-ink-muted">{periodNote(meta)}</p>
      <TableToggle open={showTable} onToggle={() => setShowTable((v) => !v)} />
      {showTable ? (
        <DataTable
          caption={`Rata-rata bulanan ${meta.label} per WPP`}
          rows={rows}
          rowKey={(a) => a}
          columns={[
            { key: "a", header: "Wilayah", cell: (a) => <span className="whitespace-nowrap">{AREA_LABEL(a)}</span> },
            ...MONTH_SHORT.map((m, i) => ({ key: m, header: m, align: "right" as const, cell: (a: string) => fmtVar(key, data[a].mean[i]) })),
            { key: "pk", header: "Puncak", cell: (a: string) => (data[a].peak ? MONTH_SHORT[data[a].peak! - 1] : "—") },
            { key: "amp", header: "Amplitudo", align: "right", cell: (a: string) => fmtVar(key, data[a].amplitude) },
          ]}
        />
      ) : null}
    </div>
  );
}

export function periodNote(meta: OceanVarMeta): string {
  if (meta.kind === "series") return `Rata-rata per bulan kalender ${meta.period.climatology?.join("–")} dari data ${meta.dataset}.`;
  if (meta.kind === "year")
    return `Satu tahun contoh (${meta.period.year}), rata-rata bulanan dari sampel tiap ${meta.period.strideHours} jam data ${meta.dataset} — bukan rata-rata jangka panjang.`;
  const b = meta.period.climatologyBounds;
  return `Klimatologi model gelombang${b ? ` (${b[0].slice(0, 4)}–${b[1].slice(0, 4)})` : ""} dari ${meta.dataset}; tidak tersedia deret per tahun.`;
}

const DIRECTION = {
  up: { icon: ArrowUpRight, label: "Naik signifikan" },
  down: { icon: ArrowDownRight, label: "Turun signifikan" },
  none: { icon: ArrowRight, label: "Tidak signifikan" },
} as const;

/** Deret bulanan per wilayah + uji tren Mann-Kendall/Sen untuk rata-rata tahunan. */
export function TrendSection({ variables, series, trends, areas }: { variables: OceanVarMeta[]; series: OceanSeries; trends: OceanTrends; areas: string[] }) {
  const vars = variables.filter((v) => v.kind === "series");
  const [key, setKey] = useState<OceanVarKey>(() => pick(vars, "sst"));
  const [area, setArea] = useState("total");
  const meta = vars.find((v) => v.key === key)!;
  const s = series[key]!;
  const t = trends[key]!;
  const months = s.months;
  const januaries = months.map((m, i) => (m.endsWith("-01") && Number(m.slice(0, 4)) % 2 === 0 ? i : -1)).filter((i) => i >= 0);
  const fmt = (v: number | null) => (v === null ? "—" : `${fmtVar(key, v)} ${meta.unit}`);
  const tickDigits = VAR_STYLE[key].digits >= 2 ? 1 : 0;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <VarPicker variables={vars} value={key} onChange={setKey} />
      <Chips label="Pilih wilayah" value={area} onChange={setArea} options={["total", ...areas].map((a) => ({ key: a, label: AREA_LABEL(a) }))} />
      <LineChart
        x={months.map(monthLabel)}
        xHeader="Bulan"
        xTicks={januaries}
        caption={`${meta.label} bulanan, ${AREA_LABEL(area)}`}
        format={fmt}
        tickFormat={(v) => fmtNum(v, tickDigits)}
        allowNegative
        height={260}
        series={[
          { key: "a", label: AREA_LABEL(area), color: "#2a78d6", values: s[area] ?? [] },
          ...(area !== "total" ? [{ key: "t", label: "Semua WPP", color: "#929292", values: s.total, dashed: true }] : []),
        ]}
      />
      <div>
        <h3 className="mb-2 font-semibold text-ink">
          Tren tahunan {t.years[0]}–{t.years[t.years.length - 1]}
        </h3>
        <DataTable
          caption={`Uji tren Mann-Kendall dan Sen's slope ${meta.label}`}
          rows={["total", ...areas].filter((a) => t[a])}
          rowKey={(a) => a}
          columns={[
            { key: "a", header: "Wilayah", cell: (a) => <span className={cn("whitespace-nowrap", a === "total" && "font-semibold")}>{AREA_LABEL(a)}</span> },
            { key: "f", header: `Rata-rata ${t.years[0]}`, align: "right", cell: (a) => fmtVar(key, t[a].annual[0]) },
            { key: "l", header: `Rata-rata ${t.years[t.years.length - 1]}`, align: "right", cell: (a) => fmtVar(key, t[a].annual[t[a].annual.length - 1]) },
            { key: "s", header: `Sen's slope per dekade (${meta.unit || "unit"})`, align: "right", cell: (a) => fmtSignedNum(t[a].senPerDecade, Math.max(2, VAR_STYLE[key].digits)) },
            { key: "p", header: "p-value", align: "right", cell: (a) => fmtP(t[a].p) },
            {
              key: "d",
              header: "Arah",
              cell: (a) => {
                const d = DIRECTION[t[a].direction ?? "none"];
                const Icon = d.icon;
                return (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <Icon aria-hidden className="h-3.5 w-3.5" />
                    {d.label}
                  </span>
                );
              },
            },
          ]}
        />
        <p className="mt-2 text-caption text-ink-muted">
          Uji Mann-Kendall dua sisi (α = 0,05) pada rata-rata tahunan tahun yang lengkap. Sen&apos;s slope per dekade = perubahan median per 10 tahun.
        </p>
      </div>
    </div>
  );
}

function normalize(vals: Array<number | null>): Array<number | null> {
  const f = vals.filter((v): v is number => v !== null);
  if (!f.length) return vals.map(() => null);
  const lo = Math.min(...f);
  const hi = Math.max(...f);
  return vals.map((v) => (v === null ? null : hi > lo ? ((v - lo) / (hi - lo)) * 100 : 50));
}

/** Pola musiman variabel laut vs deteksi kapal VIIRS + korelasi. */
export function LinkSection({ variables, seasonal, link, areas }: { variables: OceanVarMeta[]; seasonal: OceanSeasonal; link: OceanLink; areas: string[] }) {
  const [key, setKey] = useState<OceanVarKey>(() => pick(variables, "chl"));
  const [area, setArea] = useState("total");
  const meta = variables.find((v) => v.key === key)!;
  const sv = seasonal[key]?.[area]?.mean ?? [];
  const det = link.viirsSeasonal[area] ?? [];
  const rows = variables
    .map((v) => ({ v, c: link.vars[v.key]?.[area] }))
    .filter((r) => r.c)
    .sort((a, b) => Math.abs(b.c!.season.r ?? 0) - Math.abs(a.c!.season.r ?? 0));
  const rLabel = (r: number | null) => (r === null ? "—" : Math.abs(r) >= 0.7 ? "kuat" : Math.abs(r) >= 0.4 ? "sedang" : "lemah");
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <VarPicker variables={variables} value={key} onChange={setKey} />
      <Chips label="Pilih wilayah" value={area} onChange={setArea} options={["total", ...areas].map((a) => ({ key: a, label: AREA_LABEL(a) }))} />
      <LineChart
        x={MONTH_SHORT}
        xHeader="Bulan"
        caption={`Pola musiman ${meta.label} dan deteksi kapal VIIRS, ${AREA_LABEL(area)} (indeks 0–100)`}
        format={(v) => (v === null ? "—" : `${fmtNum(v, 0)}`)}
        tickFormat={(v) => fmtNum(v, 0)}
        height={240}
        series={[
          { key: "d", label: "Deteksi kapal malam (VIIRS)", color: "#172b22", values: normalize(det), dots: true },
          { key: "v", label: meta.label, color: "#eb6834", values: normalize(sv), dots: true, dashed: true },
        ]}
      />
      <p className="text-caption text-ink-muted">
        Kedua garis diubah ke indeks 0–100 (0 = bulan terendah, 100 = bulan tertinggi) agar bentuk musimnya bisa dibandingkan. Nilai asli:{" "}
        deteksi {formatCount(Math.round(Math.max(...det.filter((x): x is number => x !== null), 0)))} per bulan di puncak;{" "}
        {meta.label.toLowerCase()} {fmtVar(key, seasonal[key]?.[area]?.mean[(seasonal[key]?.[area]?.peak ?? 1) - 1])} {meta.unit} di puncak (
        {seasonal[key]?.[area]?.peak ? MONTH_LONG[seasonal[key]![area].peak! - 1] : "—"}).
      </p>
      <div>
        <h3 className="mb-2 font-semibold text-ink">Korelasi dengan deteksi kapal · {AREA_LABEL(area)}</h3>
        <DataTable
          caption={`Korelasi variabel laut dengan deteksi kapal VIIRS, ${AREA_LABEL(area)}`}
          rows={rows}
          rowKey={(r) => r.v.key}
          columns={[
            { key: "v", header: "Variabel", cell: (r) => <span className={cn(r.v.key === key && "font-semibold")}>{r.v.label}</span> },
            { key: "rs", header: "r pola musiman", align: "right", cell: (r) => fmtSignedNum(r.c!.season.r, 2) },
            { key: "ks", header: "Kekuatan", cell: (r) => rLabel(r.c!.season.r) },
            { key: "ps", header: "p (n = 12)", align: "right", cell: (r) => fmtP(r.c!.season.p) },
            { key: "ra", header: "r anomali bulanan", align: "right", cell: (r) => (r.c!.anomaly ? fmtSignedNum(r.c!.anomaly.r, 2) : "—") },
            { key: "pa", header: "p anomali", align: "right", cell: (r) => (r.c!.anomaly ? fmtP(r.c!.anomaly.p) : "—") },
          ]}
        />
        <p className="mt-2 text-caption text-ink-muted">
          <strong className="font-medium text-ink">r pola musiman</strong>: korelasi 12 rata-rata bulanan (apakah naik-turunnya sejalan sepanjang tahun).{" "}
          <strong className="font-medium text-ink">r anomali bulanan</strong>: korelasi penyimpangan dari pola musim tiap bulan 2012–2025 (apakah bulan
          yang lebih ekstrem dari biasanya juga punya deteksi yang lebih tinggi/rendah dari biasanya). Korelasi bukan sebab-akibat; deret waktu
          saling bergantung sehingga p-value anomali cenderung terlalu kecil.
        </p>
      </div>
    </div>
  );
}
