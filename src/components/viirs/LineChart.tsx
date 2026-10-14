"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { cn } from "@/lib/cn";

/**
 * Grafik garis multi-seri untuk menu VIIRS (satu sumbu y). Garis 2px, crosshair + tooltip saat hover/fokus,
 * panah kiri/kanan untuk membaca nilai, legenda selalu ada untuk ≥ 2 seri, dan tabel setara (kecuali mode ringkas
 * small-multiple). Nilai null = tidak ada data (celah), bukan nol.
 */

export type LineSeries = {
  key: string;
  label: string;
  color: string;
  values: Array<number | null>;
  dashed?: boolean;
  /** Titik di setiap nilai (data tahunan/diskret). */
  dots?: boolean;
  width?: number;
};

export type Marker = { at: number; label: string };
export type Shade = { from: number; to: number; label: string };

type LineChartProps = {
  /** Label sumbu x per indeks. */
  x: string[];
  series: LineSeries[];
  caption: string;
  format: (v: number | null) => string;
  /** Format ringkas untuk tick sumbu y. */
  tickFormat?: (v: number) => string;
  height?: number;
  /** Small multiple: margin kecil, tanpa legenda & tabel. */
  compact?: boolean;
  markers?: Marker[];
  shades?: Shade[];
  /** Tampilkan label x hanya pada indeks ini (default: otomatis menurut lebar). */
  xTicks?: number[];
  /** Izinkan sumbu y di bawah nol (mis. komponen musiman). */
  allowNegative?: boolean;
  /** Judul kolom pertama tabel. */
  xHeader?: string;
  footer?: ReactNode;
};

const compactNumber = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

/** Tick "bulat" (1/2/2,5/5 × 10^n) yang mencakup [min, max]; nol selalu termasuk. */
export function niceRange(min: number, max: number, count = 4): number[] {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  if (!(hi - lo > 0)) return [0, 1];
  const raw = (hi - lo) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 0.999; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

function pathFor(values: Array<number | null>, x: (i: number) => number, y: (v: number) => number) {
  let d = "";
  let open = false;
  values.forEach((v, i) => {
    if (v === null) {
      open = false;
      return;
    }
    d += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    open = true;
  });
  return d;
}

export function useWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.floor(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function Legend({ items }: { items: Array<{ key: string; label: string; color: string; dashed?: boolean; swatch?: "line" | "box" }> }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-caption text-ink" aria-label="Legenda">
      {items.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          {s.swatch === "box" ? (
            <span aria-hidden className="h-3 w-3 rounded-[3px]" style={{ background: s.color }} />
          ) : (
            <svg width="24" height="8" aria-hidden>
              <line x1="1" y1="4" x2="23" y2="4" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={s.dashed ? "5 4" : undefined} />
            </svg>
          )}
          <span>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function LineChart({
  x,
  series,
  caption,
  format,
  tickFormat = (v) => (v === 0 ? "0" : compactNumber.format(v)),
  height,
  compact = false,
  markers = [],
  shades = [],
  xTicks,
  allowNegative = false,
  xHeader = "Periode",
  footer,
}: LineChartProps) {
  const [containerRef, width] = useWidth<HTMLDivElement>(compact ? 300 : 640);
  const [index, setIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const descId = useId();
  const margin = compact ? { top: 8, right: 8, bottom: 22, left: 44 } : { top: 12, right: 16, bottom: 28, left: 60 };
  const plotH = height ?? (compact ? 120 : 240);
  const n = x.length;
  const plotW = Math.max(40, width - margin.left - margin.right);
  const step = n > 1 ? plotW / (n - 1) : 0;
  const px = (i: number) => margin.left + (n > 1 ? i * step : plotW / 2);

  const ticks = useMemo(() => {
    const vals = series.flatMap((s) => s.values).filter((v): v is number => v !== null && Number.isFinite(v));
    const max = vals.length ? Math.max(...vals) : 0;
    const min = allowNegative && vals.length ? Math.min(...vals) : 0;
    return niceRange(min, max, compact ? 3 : 4);
  }, [series, allowNegative, compact]);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const py = (v: number) => margin.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

  const autoEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / (compact ? 44 : 64)))));
  const tickIdx = xTicks ?? x.map((_, i) => i).filter((i) => i % autoEvery === 0);

  function onPointerMove(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const rel = ((event.clientX - rect.left) / rect.width) * (plotW + step) - step / 2;
    setIndex(Math.min(n - 1, Math.max(0, Math.round(n > 1 ? rel / step : 0))));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const cur = index ?? n - 1;
    const next =
      event.key === "ArrowRight" ? Math.min(n - 1, cur + 1)
      : event.key === "ArrowLeft" ? Math.max(0, cur - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? n - 1
      : event.key === "Escape" ? null
      : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setIndex(next);
  }

  const tooltipW = 210;
  const tooltipLeft = index !== null ? Math.min(Math.max(px(index) - tooltipW / 2, 0), Math.max(0, width - tooltipW)) : 0;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {!compact && series.length > 1 ? <Legend items={series} /> : null}
      <div
        ref={containerRef}
        className="relative w-full min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        tabIndex={0}
        role="group"
        aria-roledescription="grafik garis"
        aria-label={`${caption}. Gunakan panah kiri/kanan untuk membaca nilai.`}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        onBlur={() => setIndex(null)}
      >
        <svg width={width} height={plotH + margin.top + margin.bottom} className="block overflow-visible" aria-hidden>
          {shades.map((s) => (
            <g key={s.label}>
              <rect
                x={px(s.from) - step / 2}
                y={margin.top}
                width={Math.max(2, px(s.to) - px(s.from) + step)}
                height={plotH}
                fill="var(--color-surface-subtle)"
              />
              {!compact ? (
                <text x={px(s.from) - step / 2 + 4} y={margin.top + 12} className="fill-ink-muted text-caption">
                  {s.label}
                </text>
              ) : null}
            </g>
          ))}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={margin.left} x2={margin.left + plotW} y1={py(t)} y2={py(t)} stroke={t === 0 ? "var(--color-border-control)" : "var(--color-chart-grid)"} strokeWidth="1" />
              <text x={margin.left - 6} y={py(t)} dy="0.32em" textAnchor="end" className="fill-ink-muted text-caption tabular">
                {tickFormat(t)}
              </text>
            </g>
          ))}
          {tickIdx.map((i) => (
            <text key={i} x={px(i)} y={margin.top + plotH + (compact ? 16 : 20)} textAnchor="middle" className="fill-ink-muted text-caption">
              {x[i]}
            </text>
          ))}
          {markers.map((m) => (
            <g key={m.label}>
              <line x1={px(m.at)} x2={px(m.at)} y1={margin.top} y2={margin.top + plotH} stroke="var(--color-ink-muted)" strokeWidth="1" strokeDasharray="3 3" />
              {!compact ? (
                <text x={px(m.at) + 4} y={margin.top + plotH - 6} className="fill-ink-muted text-caption">
                  {m.label}
                </text>
              ) : null}
            </g>
          ))}
          {series.map((s) => (
            <g key={s.key}>
              <path
                d={pathFor(s.values, px, py)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width ?? 2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.dots
                ? s.values.map((v, i) =>
                    v === null ? null : <circle key={i} cx={px(i)} cy={py(v)} r={compact ? 2.5 : 3.5} fill={s.color} stroke="var(--color-surface)" strokeWidth="1.5" />,
                  )
                : null}
            </g>
          ))}
          {index !== null ? (
            <g>
              <line x1={px(index)} x2={px(index)} y1={margin.top} y2={margin.top + plotH} stroke="var(--color-border-control)" strokeWidth="1" />
              {series.map((s) =>
                s.values[index] == null ? null : (
                  <circle key={s.key} cx={px(index)} cy={py(s.values[index]!)} r="4.5" fill={s.color} stroke="var(--color-surface)" strokeWidth="2" />
                ),
              )}
            </g>
          ) : null}
          <rect
            x={margin.left - step / 2}
            y={margin.top}
            width={plotW + step}
            height={plotH}
            fill="transparent"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setIndex(null)}
          />
        </svg>
        <p id={descId} className="sr-only">
          Celah pada garis berarti tidak ada data, bukan nol.{compact ? "" : " Tabel setara tersedia lewat tombol Lihat tabel."}
        </p>
        {index !== null ? (
          <div
            role="status"
            aria-live="polite"
            className="glass-strong pointer-events-none absolute top-0 z-10 rounded-button border p-3 text-caption"
            style={{ left: tooltipLeft, width: tooltipW }}
          >
            <p className="font-semibold text-ink">{x[index]}</p>
            {series.map((s) => (
              <p key={s.key} className="mt-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-ink-muted">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="tabular font-medium text-ink">{format(s.values[index] ?? null)}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      {footer}
      {!compact ? (
        <>
          <div>
            <button type="button" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable} className="font-medium text-primary underline underline-offset-2">
              {showTable ? "Sembunyikan tabel" : "Lihat tabel"}
            </button>
          </div>
          {showTable ? (
            <DataTable
              caption={caption}
              rows={x.map((label, i) => ({ label, i }))}
              rowKey={(r) => String(r.i)}
              columns={[
                { key: "x", header: xHeader, cell: (r) => r.label },
                ...series.map((s) => ({ key: s.key, header: s.label, align: "right" as const, cell: (r: { i: number }) => format(s.values[r.i] ?? null) })),
              ]}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Kartu kecil untuk small multiples. */
export function MiniPanel({ title, subtitle, children, className }: { title: string; subtitle?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 rounded-button border border-border bg-white/60 p-3", className)}>
      <p className="font-semibold text-ink">{title}</p>
      {subtitle ? <div className="text-caption text-ink-muted">{subtitle}</div> : null}
      {children}
    </div>
  );
}
