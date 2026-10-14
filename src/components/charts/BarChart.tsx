"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { DataTable } from "@/components/ui/DataTable";

/**
 * Grafik batang horizontal satu seri (nilai sudah diformat di server). Batang tipis berujung bulat 4px dari garis
 * nol, label & nilai memakai warna teks (bukan warna seri), hover/fokus menampilkan rincian, dan selalu ada tabel
 * setara. Nilai null = tidak ada data (tanpa batang), bukan nol.
 */

export type BarDatum = {
  key: string;
  label: string;
  /** Keterangan kecil di bawah label (mis. kode asli GFW). */
  hint?: string;
  value: number | null;
  /** Nilai utama yang sudah diformat, termasuk satuan. */
  display: string;
  /** Rincian tambahan untuk tooltip & tabel: [judul kolom, nilai terformat]. */
  extra?: Array<[string, string]>;
  /** Tandai batang (mis. wilayah terpilih) dengan warna penuh; lainnya sedikit lebih pudar. */
  highlight?: boolean;
};

type BarChartProps = {
  data: BarDatum[];
  /** Judul tabel & label aksesibel. */
  caption: string;
  /** Judul kolom nilai pada tabel. */
  valueHeader: string;
  color: string;
  /** Batas jumlah batang yang digambar; sisanya tetap ada di tabel. */
  maxBars?: number;
  className?: string;
};

export function BarChart({ data, caption, valueHeader, color, maxBars = 12, className }: BarChartProps) {
  const [showTable, setShowTable] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const descId = useId();
  const shown = data.slice(0, maxBars);
  const max = Math.max(0, ...shown.map((d) => d.value ?? 0));
  const anyHighlight = shown.some((d) => d.highlight);
  const extraHeaders = data.find((d) => d.extra?.length)?.extra?.map(([h]) => h) ?? [];

  if (data.length === 0) return <p className="text-ink-muted">Tidak ada data untuk ditampilkan.</p>;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ul role="list" aria-label={caption} aria-describedby={descId} className="flex flex-col gap-1">
        {shown.map((d) => {
          const pct = d.value !== null && max > 0 ? Math.max(0.5, (d.value / max) * 100) : 0;
          const isActive = active === d.key;
          return (
            <li
              key={d.key}
              tabIndex={0}
              onPointerEnter={() => setActive(d.key)}
              onPointerLeave={() => setActive((a) => (a === d.key ? null : a))}
              onFocus={() => setActive(d.key)}
              onBlur={() => setActive((a) => (a === d.key ? null : a))}
              aria-label={`${d.label}: ${d.display}${d.extra?.length ? `; ${d.extra.map(([h, v]) => `${h} ${v}`).join("; ")}` : ""}`}
              className={cn(
                "relative grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-x-3 rounded-input px-2 py-1.5 outline-none sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]",
                "focus-visible:ring-2 focus-visible:ring-primary",
                isActive && "bg-surface-subtle",
              )}
            >
              <span className="min-w-0">
                <span className={cn("block truncate text-ink", d.highlight && "font-semibold")}>{d.label}</span>
                {d.hint ? <span className="block truncate text-caption text-ink-muted">{d.hint}</span> : null}
              </span>
              <span aria-hidden className="relative h-3.5 min-w-0">
                <span className="absolute inset-y-0 left-0 w-px bg-border-control" />
                {d.value !== null ? (
                  <span
                    className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-300 motion-reduce:transition-none"
                    style={{ width: `${pct}%`, background: color, opacity: anyHighlight && !d.highlight ? 0.45 : 1 }}
                  />
                ) : null}
              </span>
              <span className={cn("tabular text-right whitespace-nowrap", d.value === null ? "text-ink-muted" : "text-ink")}>{d.display}</span>
              {isActive && d.extra?.length ? (
                <span
                  role="status"
                  className="glass-strong pointer-events-none absolute top-full right-2 z-10 mt-1 flex min-w-[200px] flex-col gap-1 rounded-button border p-3 text-caption"
                >
                  <span className="font-semibold text-ink">{d.label}</span>
                  {d.hint ? <span className="text-ink-muted">{d.hint}</span> : null}
                  <span className="flex justify-between gap-3">
                    <span className="text-ink-muted">{valueHeader}</span>
                    <span className="tabular font-medium text-ink">{d.display}</span>
                  </span>
                  {d.extra.map(([h, v]) => (
                    <span key={h} className="flex justify-between gap-3">
                      <span className="text-ink-muted">{h}</span>
                      <span className="tabular text-ink">{v}</span>
                    </span>
                  ))}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p id={descId} className="sr-only">
        Panjang batang sebanding dengan nilai. Tabel setara tersedia lewat tombol Lihat tabel.
      </p>
      {data.length > shown.length ? (
        <p className="text-caption text-ink-muted">
          Menampilkan {shown.length} dari {data.length} kelompok. Semua kelompok ada di tabel.
        </p>
      ) : null}
      <div>
        <button type="button" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable} className="font-medium text-primary underline underline-offset-2">
          {showTable ? "Sembunyikan tabel" : "Lihat tabel"}
        </button>
      </div>
      {showTable ? (
        <DataTable
          caption={caption}
          rows={data}
          rowKey={(d) => d.key}
          columns={[
            { key: "label", header: "Kelompok", cell: (d) => d.label },
            { key: "v", header: valueHeader, align: "right", cell: (d) => d.display },
            ...extraHeaders.map((h, i) => ({ key: `x${i}`, header: h, align: "right" as const, cell: (d: BarDatum) => d.extra?.[i]?.[1] ?? "—" })),
          ]}
        />
      ) : null}
    </div>
  );
}
