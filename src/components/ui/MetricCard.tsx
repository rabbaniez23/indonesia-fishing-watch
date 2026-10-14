import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { EMPTY_VALUE, formatPercent } from "@/lib/format";
import { cn } from "@/lib/cn";
import { InfoTip } from "./InfoTip";

export type MetricComparison =
  | { kind: "percent"; value: number; label: string }
  | { kind: "not-computable"; label: string }
  /** Pembanding belum dimuat / gagal / tidak dihitung — disebut eksplisit, bukan disembunyikan. */
  | { kind: "unavailable"; label: string };

type MetricCardProps = {
  label: string;
  /** Penjelasan singkat istilah, tampil lewat tombol ⓘ. */
  info?: ReactNode;
  /** Nilai yang sudah diformat; null berarti tidak diketahui (bukan nol). */
  value: string | null;
  unit: string;
  period: string;
  comparison?: MetricComparison;
  /** Sumber/status, mis. Badge completeness + tautan provenance. */
  footer?: ReactNode;
  /** Kalimat penjelas saat nilai kosong (DS §7.3). */
  unknownText?: string;
  loading?: boolean;
  className?: string;
};

/** Urutan: label → nilai → unit/periode → perbandingan → sumber/status (DS §7.3). */
export function MetricCard({
  label,
  info,
  value,
  unit,
  period,
  comparison,
  footer,
  unknownText = "Data belum tersedia untuk menghitung nilai ini.",
  loading = false,
  className,
}: MetricCardProps) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-2 glass rounded-card p-4 sm:p-6",
        className,
      )}
      aria-busy={loading || undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-card-title font-semibold text-ink-muted">{label}</h3>
        {info ? <InfoTip label={label} className="-mt-1 -mr-2">{info}</InfoTip> : null}
      </div>
      {loading ? (
        <div className="h-10 w-32 animate-pulse rounded-input bg-surface-subtle" aria-label="Memuat nilai" />
      ) : (
        <p className="tabular text-metric-mobile font-semibold sm:text-metric">{value ?? EMPTY_VALUE}</p>
      )}
      <p className="text-caption text-ink-muted">
        {[unit, period].filter(Boolean).join(" · ")}
      </p>
      {!loading && value === null ? <p className="text-caption text-ink-muted">{unknownText}</p> : null}
      {comparison && !loading ? <ComparisonLine comparison={comparison} /> : null}
      {footer ? <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">{footer}</div> : null}
    </section>
  );
}

/** Delta memakai warna netral + panah; kenaikan bukan otomatis positif/pelanggaran. */
function ComparisonLine({ comparison }: { comparison: MetricComparison }) {
  if (comparison.kind === "unavailable") {
    return <p className="text-caption text-ink-muted">{comparison.label}</p>;
  }
  if (comparison.kind === "not-computable") {
    return <p className="text-caption text-ink-muted">Persentase tidak dapat dihitung · {comparison.label}</p>;
  }
  const Icon = comparison.value > 0 ? ArrowUpRight : comparison.value < 0 ? ArrowDownRight : ArrowRight;
  return (
    <p className="flex flex-wrap items-center gap-1 text-caption text-ink">
      <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
      <span className="tabular font-medium">{formatPercent(comparison.value)}</span>
      <span className="text-ink-muted">{comparison.label}</span>
    </p>
  );
}
