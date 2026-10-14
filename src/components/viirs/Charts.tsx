"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { cn } from "@/lib/cn";
import { formatCount } from "@/lib/format";
import { CLASS_COLOR, CLASS_LABEL, CLASS_RULE, MONTH_SHORT, RADIANCE_UNIT, fmt1, fmt2, fmtShare } from "@/lib/viirs/format";
import { RADIANCE_CLASSES, type RadianceClass, type ViirsRadianceHist } from "@/lib/viirs/types";
import { Legend, niceRange, useWidth } from "./LineChart";

const compactNumber = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className="font-medium text-primary underline underline-offset-2">
        {open ? "Sembunyikan tabel" : "Lihat tabel"}
      </button>
    </div>
  );
}

function classOf(value: number, [lowMax, highMin]: [number, number]): RadianceClass {
  return value < lowMax ? "low" : value > highMin ? "high" : "medium";
}

const radianceNumber = new Intl.NumberFormat("id-ID", { maximumSignificantDigits: 3 });

/** Fig 4a — histogram radiansi pada sumbu x logaritmik, batang diwarnai menurut kelas, garis ambang & median. */
export function RadianceHistogram({ hist }: { hist: ViirsRadianceHist }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const descId = useId();
  const margin = { top: 16, right: 16, bottom: 40, left: 56 };
  const plotH = 240;
  const plotW = Math.max(40, width - margin.left - margin.right);
  const logMin = Math.log10(hist.edges[0]);
  const logMax = Math.log10(hist.edges[hist.edges.length - 1]);
  const px = (v: number) => margin.left + ((Math.log10(v) - logMin) / (logMax - logMin)) * plotW;
  const ticks = niceRange(0, Math.max(...hist.counts), 4);
  const top = ticks[ticks.length - 1];
  const py = (v: number) => margin.top + plotH - (v / top) * plotH;
  const decades: number[] = [];
  for (let e = Math.ceil(logMin); e <= Math.floor(logMax); e++) decades.push(10 ** e);
  const bins = hist.counts.map((count, i) => {
    const lo = hist.edges[i];
    const hi = hist.edges[i + 1];
    return { i, lo, hi, count, cls: classOf(Math.sqrt(lo * hi), hist.thresholds) };
  });
  const total = hist.counts.reduce((a, b) => a + b, 0);
  const shownBins = bins.filter((b) => b.count > 0);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const idx = shownBins.findIndex((b) => b.i === active);
    const next =
      event.key === "ArrowRight" ? shownBins[Math.min(shownBins.length - 1, idx + 1)]
      : event.key === "ArrowLeft" ? shownBins[Math.max(0, idx < 0 ? 0 : idx - 1)]
      : undefined;
    if (!next) return;
    event.preventDefault();
    setActive(next.i);
  }

  const activeBin = active !== null ? bins[active] : null;
  const tipW = 220;
  const tipLeft = activeBin ? Math.min(Math.max(px(Math.sqrt(activeBin.lo * activeBin.hi)) - tipW / 2, 0), Math.max(0, width - tipW)) : 0;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Legend items={RADIANCE_CLASSES.map((c) => ({ key: c, label: `${CLASS_LABEL[c]} (${CLASS_RULE[c]})`, color: CLASS_COLOR[c], swatch: "box" as const }))} />
      <div
        ref={ref}
        className="relative w-full min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        tabIndex={0}
        role="group"
        aria-roledescription="histogram"
        aria-label={`Distribusi radiansi skala logaritmik, median ${fmt2(hist.median)} ${RADIANCE_UNIT}. Gunakan panah kiri/kanan untuk membaca tiap batang.`}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <svg width={width} height={plotH + margin.top + margin.bottom} className="block overflow-visible" aria-hidden>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={margin.left} x2={margin.left + plotW} y1={py(t)} y2={py(t)} stroke={t === 0 ? "var(--color-border-control)" : "var(--color-chart-grid)"} />
              <text x={margin.left - 6} y={py(t)} dy="0.32em" textAnchor="end" className="fill-ink-muted text-caption tabular">
                {t === 0 ? "0" : compactNumber.format(t)}
              </text>
            </g>
          ))}
          {decades.map((d, i) => (plotW < 420 && i % 2 === 1 ? null : (
            <text key={d} x={px(d)} y={margin.top + plotH + 18} textAnchor="middle" className="fill-ink-muted text-caption tabular">
              {radianceNumber.format(d)}
            </text>
          )))}
          <text x={margin.left + plotW / 2} y={margin.top + plotH + 36} textAnchor="middle" className="fill-ink-muted text-caption">
            Radiansi ({RADIANCE_UNIT}, skala log)
          </text>
          {shownBins.map((b) => {
            const x0 = px(b.lo) + 1;
            const x1 = px(b.hi) - 1;
            const h = plotH - (py(b.count) - margin.top);
            return (
              <g key={b.i}>
                <rect
                  x={x0}
                  y={py(b.count)}
                  width={Math.max(1, x1 - x0)}
                  height={Math.max(h, b.count > 0 ? 1 : 0)}
                  rx={Math.min(3, (x1 - x0) / 2)}
                  fill={CLASS_COLOR[b.cls]}
                  opacity={active === null || active === b.i ? 1 : 0.55}
                />
                {/* Area hover setinggi plot agar batang pendek tetap mudah ditunjuk. */}
                <rect
                  x={px(b.lo)}
                  y={margin.top}
                  width={Math.max(1, px(b.hi) - px(b.lo))}
                  height={plotH}
                  fill="transparent"
                  onPointerEnter={() => setActive(b.i)}
                  onPointerLeave={() => setActive((a) => (a === b.i ? null : a))}
                />
              </g>
            );
          })}
          {hist.thresholds.map((t) => (
            <g key={t} pointerEvents="none">
              <line x1={px(t)} x2={px(t)} y1={margin.top} y2={margin.top + plotH} stroke="var(--color-ink)" strokeWidth="1" strokeDasharray="4 3" />
              <text x={px(t) + 4} y={margin.top + 10} className="fill-ink text-caption">
                {radianceNumber.format(t)}
              </text>
            </g>
          ))}
          <g pointerEvents="none">
            <line x1={px(hist.median)} x2={px(hist.median)} y1={margin.top + 18} y2={margin.top + plotH} stroke="var(--color-ink-muted)" strokeWidth="1.5" />
            <text x={px(hist.median) - 4} y={margin.top + 30} textAnchor="end" className="fill-ink-muted text-caption">
              median {fmt2(hist.median)}
            </text>
          </g>
        </svg>
        <p id={descId} className="sr-only">
          Garis putus-putus menandai ambang kelas 10 dan 400 {RADIANCE_UNIT}. Tabel setara tersedia lewat tombol Lihat tabel.
        </p>
        {activeBin ? (
          <div role="status" aria-live="polite" className="glass-strong pointer-events-none absolute top-0 z-10 rounded-button border p-3 text-caption" style={{ left: tipLeft, width: tipW }}>
            <p className="font-semibold text-ink">
              {radianceNumber.format(activeBin.lo)} – {radianceNumber.format(activeBin.hi)} {RADIANCE_UNIT}
            </p>
            <p className="mt-1 flex justify-between gap-2">
              <span className="text-ink-muted">Deteksi</span>
              <span className="tabular font-medium text-ink">{formatCount(activeBin.count)}</span>
            </p>
            <p className="mt-1 flex justify-between gap-2">
              <span className="text-ink-muted">Kelas</span>
              <span className="text-ink">{CLASS_LABEL[activeBin.cls]}</span>
            </p>
          </div>
        ) : null}
      </div>
      {hist.excludedNonPositive > 0 ? (
        <p className="text-caption text-ink-muted">{formatCount(hist.excludedNonPositive)} deteksi dengan radiansi ≤ 0 tidak dapat digambar pada skala log.</p>
      ) : null}
      <TableToggle open={showTable} onToggle={() => setShowTable((v) => !v)} />
      {showTable ? (
        <DataTable
          caption="Histogram radiansi"
          rows={shownBins}
          rowKey={(b) => String(b.i)}
          columns={[
            { key: "r", header: `Rentang (${RADIANCE_UNIT})`, cell: (b) => `${radianceNumber.format(b.lo)} – ${radianceNumber.format(b.hi)}` },
            { key: "c", header: "Kelas", cell: (b) => CLASS_LABEL[b.cls] },
            { key: "n", header: "Deteksi", align: "right", cell: (b) => formatCount(b.count) },
            { key: "p", header: "Porsi", align: "right", cell: (b) => fmtShare((b.count / total) * 100) },
          ]}
        />
      ) : null}
    </div>
  );
}

export type CompositionRow = {
  key: string;
  label: string;
  hint?: string;
  n: number;
  classes: Record<RadianceClass, number>;
  pct: Record<RadianceClass, number | null>;
  emphasis?: boolean;
};

/** Fig 4b & 5 — komposisi kelas radiansi (batang bertumpuk 100%) dengan celah 2px antarsegmen. */
export function ClassComposition({ rows, caption }: { rows: CompositionRow[]; caption: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Legend items={RADIANCE_CLASSES.map((c) => ({ key: c, label: `${CLASS_LABEL[c]} (${CLASS_RULE[c]})`, color: CLASS_COLOR[c], swatch: "box" as const }))} />
      <ul role="list" aria-label={caption} className="flex flex-col gap-1">
        {rows.map((r) => {
          const isActive = active === r.key;
          return (
            <li
              key={r.key}
              tabIndex={0}
              onPointerEnter={() => setActive(r.key)}
              onPointerLeave={() => setActive((a) => (a === r.key ? null : a))}
              onFocus={() => setActive(r.key)}
              onBlur={() => setActive((a) => (a === r.key ? null : a))}
              aria-label={`${r.label}: ${RADIANCE_CLASSES.map((c) => `${CLASS_LABEL[c]} ${fmtShare(r.pct[c])}`).join(", ")}; ${formatCount(r.n)} deteksi`}
              className={cn(
                "relative grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] items-center gap-x-3 rounded-input px-2 py-1.5 outline-none sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]",
                "focus-visible:ring-2 focus-visible:ring-primary",
                isActive && "bg-surface-subtle",
                r.emphasis && "border-b border-border pb-2",
              )}
            >
              <span className="min-w-0">
                <span className={cn("block truncate text-ink", r.emphasis && "font-semibold")}>{r.label}</span>
                {r.hint ? <span className="block truncate text-caption text-ink-muted">{r.hint}</span> : null}
              </span>
              <span aria-hidden className="flex h-6 min-w-0 gap-[2px] overflow-hidden rounded-[4px]">
                {RADIANCE_CLASSES.map((c) => {
                  const p = r.pct[c] ?? 0;
                  if (p <= 0) return null;
                  return <span key={c} className="h-full" style={{ width: `${p}%`, minWidth: 2, background: CLASS_COLOR[c] }} />;
                })}
              </span>
              {isActive ? (
                <span role="status" className="glass-strong pointer-events-none absolute top-full right-2 z-10 mt-1 flex min-w-[220px] flex-col gap-1 rounded-button border p-3 text-caption">
                  <span className="font-semibold text-ink">{r.label}</span>
                  {r.hint ? <span className="text-ink-muted">{r.hint}</span> : null}
                  {RADIANCE_CLASSES.map((c) => (
                    <span key={c} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-ink-muted">
                        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: CLASS_COLOR[c] }} />
                        {CLASS_LABEL[c]}
                      </span>
                      <span className="tabular text-ink">
                        {fmtShare(r.pct[c])} · {formatCount(r.classes[c])}
                      </span>
                    </span>
                  ))}
                  <span className="flex justify-between gap-3 border-t border-border pt-1">
                    <span className="text-ink-muted">Total deteksi</span>
                    <span className="tabular font-medium text-ink">{formatCount(r.n)}</span>
                  </span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-caption text-ink-muted">Arahkan kursor atau fokus ke baris untuk melihat persentase tiap kelas; semua nilai juga ada di tabel.</p>
      <TableToggle open={showTable} onToggle={() => setShowTable((v) => !v)} />
      {showTable ? (
        <DataTable
          caption={caption}
          rows={rows}
          rowKey={(r) => r.key}
          columns={[
            { key: "l", header: "Wilayah", cell: (r) => r.label },
            ...RADIANCE_CLASSES.map((c) => ({ key: c, header: `${CLASS_LABEL[c]} (%)`, align: "right" as const, cell: (r: CompositionRow) => fmtShare(r.pct[c]) })),
            { key: "n", header: "Deteksi", align: "right", cell: (r) => formatCount(r.n) },
          ]}
        />
      ) : null}
    </div>
  );
}

export type CvRow = { key: string; label: string; cv: number | null; cvClass: "stable" | "moderate" | "high"; mean: number | null; sd: number | null };

/** Status stabilitas (paper: hijau/kuning/merah) — selalu disertai label teks, bukan warna saja. */
export const CV_CLASS: Record<CvRow["cvClass"], { label: string; color: string; rule: string }> = {
  stable: { label: "Stabil", color: "#0ca30c", rule: "CV < 30%" },
  moderate: { label: "Cukup bervariasi", color: "#fab219", rule: "CV 30–50%" },
  high: { label: "Sangat bervariasi", color: "#d03b3b", rule: "CV > 50%" },
};

/** Fig 10 — koefisien variasi deteksi tahunan per WPP, diurutkan dari paling stabil. */
export function CvChart({ rows, caption }: { rows: CvRow[]; caption: string }) {
  const [showTable, setShowTable] = useState(false);
  const sorted = [...rows].sort((a, b) => (a.cv ?? 0) - (b.cv ?? 0));
  const max = Math.max(...sorted.map((r) => r.cv ?? 0), 50);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Legend items={(Object.keys(CV_CLASS) as CvRow["cvClass"][]).map((k) => ({ key: k, label: `${CV_CLASS[k].label} (${CV_CLASS[k].rule})`, color: CV_CLASS[k].color, swatch: "box" as const }))} />
      <ul role="list" aria-label={caption} className="flex flex-col gap-1">
        {sorted.map((r) => (
          <li
            key={r.key}
            aria-label={`${r.label}: CV ${fmtShare(r.cv)}, ${CV_CLASS[r.cvClass].label}`}
            className="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_auto] items-center gap-x-3 px-2 py-1 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,11rem)]"
          >
            <span className="truncate text-ink">{r.label}</span>
            <span aria-hidden className="relative h-3.5 min-w-0">
              <span className="absolute inset-y-0 left-0 w-px bg-border-control" />
              {[30, 50].map((t) => (
                <span key={t} className="absolute inset-y-[-4px] w-px border-l border-dashed border-ink-muted" style={{ left: `${(t / max) * 100}%` }} />
              ))}
              <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${((r.cv ?? 0) / max) * 100}%`, background: CV_CLASS[r.cvClass].color }} />
            </span>
            <span className="flex items-center justify-end gap-2 whitespace-nowrap">
              <span className="tabular text-ink">{fmtShare(r.cv)}</span>
              <span className="hidden text-caption text-ink-muted sm:inline">{CV_CLASS[r.cvClass].label}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-caption text-ink-muted">Garis putus-putus: batas CV 30% dan 50%.</p>
      <TableToggle open={showTable} onToggle={() => setShowTable((v) => !v)} />
      {showTable ? (
        <DataTable
          caption={caption}
          rows={sorted}
          rowKey={(r) => r.key}
          columns={[
            { key: "l", header: "Wilayah", cell: (r) => r.label },
            { key: "m", header: "Rata-rata/tahun", align: "right", cell: (r) => formatCount(r.mean) },
            { key: "s", header: "Simpangan baku", align: "right", cell: (r) => formatCount(r.sd) },
            { key: "c", header: "CV", align: "right", cell: (r) => fmtShare(r.cv) },
            { key: "k", header: "Kategori", cell: (r) => CV_CLASS[r.cvClass].label },
          ]}
        />
      ) : null}
    </div>
  );
}

/** Ramp sekuensial biru (satu hue, terang → gelap) untuk heatmap. */
const BLUE_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

function rampColor(t: number): string {
  const i = Math.min(BLUE_RAMP.length - 1, Math.max(0, Math.floor(t * BLUE_RAMP.length)));
  return BLUE_RAMP[i];
}

export type HeatmapRow = { key: string; label: string; values: Array<number | null> };

/** Fig 12 — rata-rata deteksi per bulan per WPP; warna memakai skala akar (nilai^0,4) yang sama untuk semua sel. */
export function MonthlyHeatmap({ rows, caption, power = 0.4 }: { rows: HeatmapRow[]; caption: string; power?: number }) {
  const [active, setActive] = useState<{ r: number; m: number } | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(...rows.flatMap((r) => r.values.map((v) => v ?? 0)));
  const scaled = (v: number) => (max > 0 ? Math.pow(v, power) / Math.pow(max, power) : 0);
  const legendStops = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.pow(t, 1 / power) * max);
  const activeRow = active ? rows[active.r] : null;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label={`${caption}. Arahkan kursor ke sel untuk melihat nilai; tabel setara tersedia.`}>
        <table className="w-full min-w-[560px] border-separate border-spacing-[2px] text-caption" aria-hidden>
          <thead>
            <tr>
              <th className="w-[5.5rem]" />
              {MONTH_SHORT.map((m) => (
                <th key={m} className="font-medium text-ink-muted">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.key}>
                <th scope="row" className="pr-2 text-left font-medium whitespace-nowrap text-ink">
                  {r.label}
                </th>
                {r.values.map((v, mi) => {
                  const t = v === null ? 0 : scaled(v);
                  const isActive = active?.r === ri && active.m === mi;
                  return (
                    <td
                      key={mi}
                      onPointerEnter={() => setActive({ r: ri, m: mi })}
                      onPointerLeave={() => setActive(null)}
                      className={cn("h-8 rounded-[4px]", isActive && "outline-2 outline-ink")}
                      style={{ background: v === null ? "var(--color-surface-subtle)" : rampColor(t) }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-caption text-ink-muted">
          <span>Rendah</span>
          <span aria-hidden className="flex h-3 w-40 overflow-hidden rounded-[3px]">
            {BLUE_RAMP.map((c) => (
              <span key={c} className="h-full flex-1" style={{ background: c }} />
            ))}
          </span>
          <span>Tinggi</span>
          <span className="tabular">(0 – {formatCount(Math.round(legendStops[4]))} deteksi/bulan, skala akar ^{fmt1(power)})</span>
        </div>
        <p role="status" aria-live="polite" className="min-h-5 text-caption text-ink">
          {activeRow && active ? (
            <>
              <span className="font-semibold">{activeRow.label}</span> · {MONTH_SHORT[active.m]}:{" "}
              <span className="tabular">{formatCount(activeRow.values[active.m] === null ? null : Math.round(activeRow.values[active.m]!))}</span> deteksi rata-rata
            </>
          ) : (
            <span className="text-ink-muted">Arahkan kursor ke sel untuk melihat nilai.</span>
          )}
        </p>
      </div>
      <TableToggle open={showTable} onToggle={() => setShowTable((v) => !v)} />
      {showTable ? (
        <DataTable
          caption={caption}
          rows={rows}
          rowKey={(r) => r.key}
          columns={[
            { key: "l", header: "Wilayah", cell: (r) => r.label },
            ...MONTH_SHORT.map((m, i) => ({
              key: m,
              header: m,
              align: "right" as const,
              cell: (r: HeatmapRow) => formatCount(r.values[i] === null ? null : Math.round(r.values[i]!)),
            })),
          ]}
        />
      ) : null}
    </div>
  );
}
