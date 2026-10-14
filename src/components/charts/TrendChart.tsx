"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { formatCount, formatHours } from "@/lib/format";
import { DataTable } from "@/components/ui/DataTable";
import { StateView } from "@/components/ui/StateView";

export type TrendPoint = { date: string; value: number | null };

export type TrendSeries = {
  key: string;
  label: string;
  unit: string;
  valueFormat: "hours" | "count";
  /** CSS color (token var) untuk garis periode aktif. */
  color: string;
  current: TrendPoint[] | null;
  previous: TrendPoint[] | null;
  currentLabel: string;
  previousLabel: string;
  /** Catatan dekat grafik (mis. hari tanpa baris, kelengkapan). */
  notes: string[];
  state: "ready" | "loading" | "error";
  errorMessage?: string | null;
};

type TrendChartProps = {
  series: TrendSeries[];
  initialKey: string;
  regionName: string;
  /** Nama query param untuk menyimpan pilihan metric di URL (nonrahasia). */
  urlParam?: string;
  /** Label legenda (default "Periode dipilih" / "Periode sebelumnya"). */
  labels?: { current: string; previous: string };
};

const PLOT_HEIGHT = 220;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 64 };

const dayLabel = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
const fullDay = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

function toDate(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

/** Tick y yang "bulat" (1/2/5 × 10^n), selalu mulai dari 0. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.0001; v += step) ticks.push(Number(v.toFixed(10)));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Path SVG dengan celah pada nilai null (hari tanpa baris ≠ nol). */
function linePath(points: TrendPoint[], x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  let open = false;
  points.forEach((p, i) => {
    if (p.value === null) {
      open = false;
      return;
    }
    d += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
    open = true;
  });
  return d;
}

/** Titik tunggal yang diapit null tidak terlihat sebagai garis — gambar sebagai dot. */
function isolatedIndexes(points: TrendPoint[]): number[] {
  return points
    .map((p, i) => (p.value !== null && points[i - 1]?.value == null && points[i + 1]?.value == null ? i : -1))
    .filter((i) => i >= 0);
}

export function TrendChart({ series, initialKey, regionName, urlParam = "trend", labels }: TrendChartProps) {
  const [selectedKey, setSelectedKey] = useState(series.some((s) => s.key === initialKey) ? initialKey : series[0]?.key);
  const [showTable, setShowTable] = useState(false);
  const active = series.find((s) => s.key === selectedKey) ?? series[0];

  function select(key: string) {
    setSelectedKey(key);
    const url = new URL(window.location.href);
    url.searchParams.set(urlParam, key);
    window.history.replaceState(null, "", url);
  }

  if (!active) return null;
  const format = active.valueFormat === "hours" ? formatHours : formatCount;

  return (
    <div className="flex flex-col gap-4">
      {series.length > 1 ? (
      <div role="group" aria-label="Pilih metrik tren" className="flex flex-wrap gap-2">
        {series.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={s.key === active.key}
            onClick={() => select(s.key)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-body transition-colors duration-150",
              s.key === active.key
                ? "border-primary bg-primary-soft font-semibold text-primary"
                : "border-border-control bg-surface text-ink hover:bg-surface-subtle",
            )}
          >
            <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
          </button>
        ))}
      </div>
      ) : null}

      {active.state === "loading" ? (
        <StateView state="loading" title="Memuat tren harian…" className="min-h-[300px]" />
      ) : active.state === "error" || !active.current ? (
        <StateView state="error" className="min-h-[300px]">
          {active.errorMessage ?? "Tren untuk metrik ini belum dapat dimuat."}
        </StateView>
      ) : (
        <>
          <Legend active={active} labels={labels} />
          <Plot active={active} format={format} regionName={regionName} />
          {active.notes.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-caption text-ink-muted">
              {active.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
          <div>
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              aria-expanded={showTable}
              className="text-body font-medium text-primary underline underline-offset-2"
            >
              {showTable ? "Sembunyikan tabel" : "Lihat tabel"}
            </button>
          </div>
          {showTable ? <TrendTable active={active} format={format} /> : null}
        </>
      )}
    </div>
  );
}

function Legend({ active, labels }: { active: TrendSeries; labels?: { current: string; previous: string } }) {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-caption text-ink-muted" aria-label="Legenda">
      <li className="flex items-center gap-2">
        <svg width="24" height="8" aria-hidden>
          <line x1="0" y1="4" x2="24" y2="4" stroke={active.color} strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>
          <span className="font-medium text-ink">{labels?.current ?? "Periode dipilih"}</span> · {active.currentLabel}
        </span>
      </li>
      {active.previous ? (
        <li className="flex items-center gap-2">
          <svg width="24" height="8" aria-hidden>
            <line x1="0" y1="4" x2="24" y2="4" stroke="var(--color-chart-compare)" strokeWidth="2" strokeDasharray="5 4" />
          </svg>
          <span>
            <span className="font-medium text-ink">{labels?.previous ?? "Periode sebelumnya"}</span> · {active.previousLabel}
          </span>
        </li>
      ) : null}
    </ul>
  );
}

function Plot({ active, format, regionName }: { active: TrendSeries; format: (v: number | null) => string; regionName: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [index, setIndex] = useState<number | null>(null);
  const descId = useId();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const current = active.current!;
  const previous = active.previous;
  const n = current.length;
  const plotW = width - MARGIN.left - MARGIN.right;
  const step = n > 1 ? plotW / (n - 1) : 0;
  const x = (i: number) => MARGIN.left + (n > 1 ? i * step : plotW / 2);

  const max = useMemo(() => {
    const values = [...current, ...(previous ?? [])].map((p) => p.value).filter((v): v is number => v !== null);
    return values.length ? Math.max(...values) : 0;
  }, [current, previous]);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const y = (v: number) => MARGIN.top + PLOT_HEIGHT - (v / top) * PLOT_HEIGHT;

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 72))));
  const hasValues = current.some((p) => p.value !== null);

  function onPointerMove(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * plotW;
    setIndex(Math.min(n - 1, Math.max(0, Math.round(n > 1 ? px / step : 0))));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = index ?? n - 1;
    const next =
      event.key === "ArrowRight" ? Math.min(n - 1, current + 1)
      : event.key === "ArrowLeft" ? Math.max(0, current - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? n - 1
      : event.key === "Escape" ? null
      : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setIndex(next);
  }

  if (!hasValues) {
    return (
      <StateView state="unknown" title="Tidak ada baris untuk periode ini" className="min-h-[260px]">
        Provider tidak mengembalikan baris untuk hari mana pun pada periode aktif. Ini tidak sama dengan nol terverifikasi.
      </StateView>
    );
  }

  const activePoint = index !== null ? current[index] : null;
  const prevPoint = index !== null && previous ? previous[index] : null;
  const tooltipLeft = index !== null ? Math.min(Math.max(x(index) - 110, 0), width - 220) : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      tabIndex={0}
      role="group"
      aria-roledescription="grafik garis"
      aria-label={`Tren harian ${active.label}, ${regionName}, ${active.currentLabel}. Gunakan panah kiri/kanan untuk membaca nilai per hari.`}
      aria-describedby={descId}
      onKeyDown={onKeyDown}
      onFocus={() => setIndex((i) => i ?? n - 1)}
      onBlur={() => setIndex(null)}
    >
      <svg width={width} height={PLOT_HEIGHT + MARGIN.top + MARGIN.bottom} className="block overflow-visible" aria-hidden>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke="var(--color-chart-grid)" strokeWidth="1" />
            <text x={MARGIN.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-muted text-caption tabular">
              {t === 0 ? "0" : compact.format(t)}
            </text>
          </g>
        ))}
        {current.map((p, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={p.date} x={x(i)} y={MARGIN.top + PLOT_HEIGHT + 20} textAnchor="middle" className="fill-ink-muted text-caption">
              {dayLabel.format(toDate(p.date))}
            </text>
          ) : null,
        )}
        {previous ? (
          <path d={linePath(previous, x, y)} fill="none" stroke="var(--color-chart-compare)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        <path d={linePath(current, x, y)} fill="none" stroke={active.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {isolatedIndexes(current).map((i) => (
          <circle key={i} cx={x(i)} cy={y(current[i].value!)} r="4" fill={active.color} stroke="var(--color-surface)" strokeWidth="2" />
        ))}
        {index !== null ? (
          <g>
            <line x1={x(index)} x2={x(index)} y1={MARGIN.top} y2={MARGIN.top + PLOT_HEIGHT} stroke="var(--color-border-control)" strokeWidth="1" />
            {prevPoint?.value != null ? (
              <circle cx={x(index)} cy={y(prevPoint.value)} r="4" fill="var(--color-chart-compare)" stroke="var(--color-surface)" strokeWidth="2" />
            ) : null}
            {activePoint?.value != null ? (
              <circle cx={x(index)} cy={y(activePoint.value)} r="5" fill={active.color} stroke="var(--color-surface)" strokeWidth="2" />
            ) : null}
          </g>
        ) : null}
        <rect
          x={MARGIN.left - step / 2}
          y={MARGIN.top}
          width={plotW + step}
          height={PLOT_HEIGHT}
          fill="transparent"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setIndex(null)}
        />
      </svg>
      <p id={descId} className="sr-only">
        Satuan {active.unit}. Hari tanpa baris dari provider ditampilkan sebagai celah, bukan nol. Tabel setara tersedia lewat tombol Lihat tabel.
      </p>
      {index !== null && activePoint ? (
        <div
          role="status"
          aria-live="polite"
          className="glass-strong pointer-events-none absolute top-0 z-10 w-[220px] rounded-button border p-3 text-caption"
          style={{ left: tooltipLeft }}
        >
          <p className="font-semibold text-ink">{fullDay.format(toDate(activePoint.date))} (UTC)</p>
          <p className="mt-1 flex justify-between gap-2">
            <span className="text-ink-muted">{active.label}</span>
            <span className="tabular font-medium text-ink">
              {activePoint.value === null ? "Tidak ada baris" : `${format(activePoint.value)} ${active.unit}`}
            </span>
          </p>
          {prevPoint ? (
            <p className="mt-1 flex justify-between gap-2">
              <span className="text-ink-muted">{fullDay.format(toDate(prevPoint.date))}</span>
              <span className="tabular text-ink">
                {prevPoint.value === null ? "Tidak ada baris" : `${format(prevPoint.value)} ${active.unit}`}
              </span>
            </p>
          ) : null}
          <p className="mt-1 text-ink-muted">{regionName}</p>
        </div>
      ) : null}
    </div>
  );
}

function TrendTable({ active, format }: { active: TrendSeries; format: (v: number | null) => string }) {
  const rows = active.current!.map((p, i) => ({ current: p, previous: active.previous?.[i] ?? null }));
  return (
    <DataTable
      caption={`Tabel tren harian ${active.label}`}
      rows={rows}
      rowKey={(r) => r.current.date}
      columns={[
        { key: "date", header: "Tanggal (UTC)", cell: (r) => fullDay.format(toDate(r.current.date)) },
        {
          key: "value",
          header: `${active.label} (${active.unit})`,
          align: "right",
          cell: (r) => (r.current.value === null ? <span className="text-ink-muted">Tidak ada baris</span> : format(r.current.value)),
        },
        ...(active.previous
          ? [
              { key: "pdate", header: "Tanggal pembanding", cell: (r: (typeof rows)[number]) => (r.previous ? fullDay.format(toDate(r.previous.date)) : "—") },
              {
                key: "pvalue",
                header: `Pembanding (${active.unit})`,
                align: "right" as const,
                cell: (r: (typeof rows)[number]) =>
                  !r.previous || r.previous.value === null ? <span className="text-ink-muted">Tidak ada baris</span> : format(r.previous.value),
              },
            ]
          : []),
      ]}
    />
  );
}
