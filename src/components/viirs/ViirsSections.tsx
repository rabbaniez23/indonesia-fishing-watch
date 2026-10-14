"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { CLASS_COLOR, CLASS_LABEL, CLASS_RULE, MONTH_SHORT, fmt1, fmt3, fmtP, fmtSigned, monthLabel } from "@/lib/viirs/format";
import { RADIANCE_CLASSES, type ForecastStat, type SeasonalStat, type TrendStat, type ViirsAnnual } from "@/lib/viirs/types";
import { Legend, LineChart, MiniPanel } from "./LineChart";

const fmtCount = (v: number | null) => formatCount(v === null ? null : Math.round(v));
const shortNumber = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const tick = (v: number) => (v === 0 ? "0" : shortNumber.format(v));

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

/** Fig 8 — deteksi tahunan per kelas radiansi, keseluruhan & per WPP. */
export function AnnualByClass({ annual, partialYearNote }: { annual: ViirsAnnual; partialYearNote: string }) {
  const [scope, setScope] = useState("total");
  const data = scope === "total" ? annual.total : annual.wpp[scope];
  const years = annual.years.map(String);
  const last = annual.years.length - 1;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Chips
        label="Pilih wilayah"
        value={scope}
        onChange={setScope}
        options={[{ key: "total", label: "Semua WPP" }, ...Object.keys(annual.wpp).map((c) => ({ key: c, label: `WPP ${c}` }))]}
      />
      <LineChart
        x={years}
        xHeader="Tahun"
        caption={`Deteksi tahunan per kelas radiansi, ${scope === "total" ? "11 WPP" : `WPP ${scope}`}`}
        format={fmtCount}
        tickFormat={tick}
        series={RADIANCE_CLASSES.map((c) => ({ key: c, label: `${CLASS_LABEL[c]} (${CLASS_RULE[c]})`, color: CLASS_COLOR[c], values: data[c], dots: true }))}
        shades={[{ from: last, to: last, label: "2026*" }]}
        footer={<p className="text-caption text-ink-muted">* {partialYearNote}</p>}
      />
    </div>
  );
}

const DIRECTION = {
  up: { icon: ArrowUpRight, label: "Naik signifikan" },
  down: { icon: ArrowDownRight, label: "Turun signifikan" },
  none: { icon: ArrowRight, label: "Tidak signifikan" },
} as const;

export function TrendBadge({ stat }: { stat: TrendStat }) {
  const d = DIRECTION[stat.direction];
  const Icon = d.icon;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {d.label}
    </span>
  );
}

/** Fig 9 — tren deteksi tahunan 2012–2025 per WPP + LOESS + hasil Mann-Kendall (skala y tiap panel berbeda). */
export function TrendGrid({ trend, years, order }: { trend: Record<string, TrendStat>; years: number[]; order: string[] }) {
  const x = years.map(String);
  const moratorium = years.indexOf(2014);
  const panels = ["total", ...order];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Legend
        items={[
          { key: "v", label: "Deteksi per tahun", color: "#2a78d6" },
          { key: "l", label: "LOESS", color: "#172b22" },
          { key: "m", label: "Moratorium kapal eks-asing (akhir 2014)", color: "#52645a", dashed: true },
        ]}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {panels.map((key) => {
          const s = trend[key];
          return (
            <MiniPanel
              key={key}
              title={key === "total" ? "Semua WPP" : `WPP ${key}`}
              subtitle={
                <span className="flex flex-wrap gap-x-2">
                  <span>τ {fmt3(s.tau)}</span>
                  <span>p {fmtP(s.p)}</span>
                  <span>Sen {fmtSigned(s.senSlope)}/thn</span>
                  <span className={cn(s.significant ? "font-medium text-ink" : "")}>
                    <TrendBadge stat={s} />
                  </span>
                </span>
              }
            >
              <LineChart
                compact
                x={x}
                xTicks={[0, Math.floor((years.length - 1) / 2), years.length - 1]}
                caption={`Tren tahunan ${key === "total" ? "semua WPP" : `WPP ${key}`}`}
                format={fmtCount}
                tickFormat={tick}
                markers={moratorium >= 0 ? [{ at: moratorium + 0.9, label: "Moratorium" }] : []}
                series={[
                  { key: "v", label: "Deteksi", color: "#2a78d6", values: s.values, dots: true, width: 1.5 },
                  { key: "l", label: "LOESS", color: "#172b22", values: s.loess },
                ]}
              />
            </MiniPanel>
          );
        })}
      </div>
      <p className="text-caption text-ink-muted">Skala sumbu y tiap panel berbeda agar pola tiap WPP terbaca; bandingkan besaran antar-WPP lewat tabel.</p>
    </div>
  );
}

/** Fig 11 — komponen musiman STL (rata-rata per bulan kalender) per WPP. */
export function SeasonalGrid({ seasonal, order }: { seasonal: Record<string, SeasonalStat>; order: string[] }) {
  const panels = ["total", ...order];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {panels.map((key) => {
          const s = seasonal[key];
          return (
            <MiniPanel
              key={key}
              title={key === "total" ? "Semua WPP" : `WPP ${key}`}
              subtitle={
                <span>
                  Puncak {MONTH_SHORT[s.peakMonth - 1]} · terendah {MONTH_SHORT[s.lowMonth - 1]} · amplitudo {formatCount(s.amplitude === null ? null : Math.round(s.amplitude))}
                </span>
              }
            >
              <LineChart
                compact
                allowNegative
                x={MONTH_SHORT}
                xTicks={[0, 3, 6, 9]}
                caption={`Komponen musiman ${key === "total" ? "semua WPP" : `WPP ${key}`}`}
                format={(v) => (v === null ? "—" : fmtSigned(v, 0))}
                tickFormat={tick}
                markers={[{ at: s.peakMonth - 1, label: "Puncak" }]}
                series={[{ key: "s", label: "Indeks musiman", color: "#2a78d6", values: s.seasonalIndex, dots: true }]}
              />
            </MiniPanel>
          );
        })}
      </div>
      <p className="text-caption text-ink-muted">
        Nilai di atas nol = bulan dengan deteksi di atas rata-rata tren; garis putus-putus menandai bulan puncak. Skala tiap panel berbeda.
      </p>
    </div>
  );
}

const MODEL_COLOR = { actual: "#172b22", sarima: "#2a78d6", ets: "#eb6834" };

/** Fig 15 — data aktual (latih/uji), prediksi SARIMA vs ETS pada periode uji, dan proyeksi hingga akhir 2027. */
export function ForecastSection({ forecast }: { forecast: Record<string, ForecastStat> }) {
  const codes = Object.keys(forecast);
  const [code, setCode] = useState(codes.includes("717") ? "717" : codes[0]);
  const f = forecast[code];
  const months = [...f.months, ...f.future.months];
  const nA = f.months.length;
  const testStart = f.months.indexOf(f.test.months[0]);
  const pad = (n: number) => Array<number | null>(n).fill(null);
  const model = (k: "sarima" | "ets") => [...pad(testStart), ...f.test[k], ...f.future[k]];
  const januaries = months.map((m, i) => (m.endsWith("-01") && Number(m.slice(0, 4)) % 2 === 0 ? i : -1)).filter((i) => i >= 0);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Chips label="Pilih WPP" value={code} onChange={setCode} options={codes.map((c) => ({ key: c, label: `WPP ${c}` }))} />
      <LineChart
        x={months.map(monthLabel)}
        xHeader="Bulan"
        xTicks={januaries}
        caption={`Prediksi deteksi bulanan WPP ${code}: SARIMA vs ETS`}
        format={fmtCount}
        tickFormat={tick}
        height={280}
        shades={[{ from: testStart, to: nA - 1, label: "Uji" }]}
        markers={[{ at: nA - 0.5, label: "Proyeksi" }]}
        series={[
          { key: "a", label: "Aktual", color: MODEL_COLOR.actual, values: [...f.actual, ...pad(f.future.months.length)], width: 1.5 },
          { key: "s", label: "SARIMA", color: MODEL_COLOR.sarima, values: model("sarima") },
          { key: "e", label: "ETS", color: MODEL_COLOR.ets, values: model("ets"), dashed: true },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {(["sarima", "ets"] as const).map((k) => {
          const m = f.metrics[k];
          const better = f.metrics[k].mape !== null && f.metrics[k === "sarima" ? "ets" : "sarima"].mape !== null && m.mape! < f.metrics[k === "sarima" ? "ets" : "sarima"].mape!;
          return (
            <div key={k} className="rounded-button border border-border bg-white/60 p-3">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: MODEL_COLOR[k] }} />
                {k === "sarima" ? "SARIMA" : "ETS"}
                {better ? <span className="text-caption font-normal text-ink-muted">· MAPE lebih kecil</span> : null}
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-caption">
                <div>
                  <dt className="text-ink-muted">MAPE</dt>
                  <dd className="tabular text-body font-medium text-ink">{fmt1(m.mape)}%</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">RMSE</dt>
                  <dd className="tabular text-body font-medium text-ink">{fmt1(m.rmse)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">MAE</dt>
                  <dd className="tabular text-body font-medium text-ink">{fmt1(m.mae)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-caption text-ink-muted">
                {k === "sarima"
                  ? `(${f.models.sarima.order.join(",")})(${f.models.sarima.seasonalOrder.slice(0, 3).join(",")})${f.models.sarima.seasonalOrder[3]}`
                  : `galat ${f.models.ets.error === "add" ? "aditif" : "multiplikatif"}, tren ${f.models.ets.trend === null ? "tidak ada" : f.models.ets.damped ? "aditif teredam" : "aditif"}, musiman ${f.models.ets.seasonal === "add" ? "aditif" : "multiplikatif"}`}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-caption text-ink-muted">
        Model dilatih {monthLabel(f.months[0])} – {monthLabel(f.trainEnd)} dan diuji {monthLabel(f.test.months[0])} –{" "}
        {monthLabel(f.test.months[f.test.months.length - 1])}. Proyeksi {monthLabel(f.future.months[0])} – {monthLabel(f.future.months[f.future.months.length - 1])} memakai model yang dilatih ulang pada seluruh data.
      </p>
    </div>
  );
}
