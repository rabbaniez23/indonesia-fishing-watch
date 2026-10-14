import type { ReactNode } from "react";
import { AlertOctagon, Ban, CircleDashed, Clock, FileQuestion, Inbox, Loader2, PieChart } from "lucide-react";
import { cn } from "@/lib/cn";

/** States minimal FR-12 + DS §11. Masing-masing tampak berbeda. */
export type DataState = "loading" | "empty" | "unknown" | "partial" | "stale" | "error" | "unsupported" | "gated";

const presets: Record<DataState, { icon: typeof Inbox; title: string; tone: string }> = {
  loading: { icon: Loader2, title: "Memuat aktivitas…", tone: "text-ink-muted" },
  empty: { icon: Inbox, title: "Tidak ada kejadian yang tercatat pada filter ini.", tone: "text-ink-muted" },
  unknown: { icon: FileQuestion, title: "Data belum tersedia untuk menghitung nilai ini.", tone: "text-neutral" },
  partial: { icon: PieChart, title: "Hasil belum mencakup seluruh permintaan.", tone: "text-warning" },
  stale: { icon: Clock, title: "Menampilkan hasil tersimpan; pembaruan belum berhasil.", tone: "text-warning" },
  error: { icon: AlertOctagon, title: "Sumber data belum dapat diakses.", tone: "text-error" },
  unsupported: { icon: Ban, title: "Data ini belum tersedia melalui akses yang digunakan.", tone: "text-neutral" },
  gated: { icon: CircleDashed, title: "Fitur belum dapat diaktifkan.", tone: "text-neutral" },
};

type StateViewProps = {
  state: DataState;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function StateView({ state, title, children, action, className }: StateViewProps) {
  const preset = presets[state];
  const Icon = preset.icon;
  return (
    <div
      role={state === "error" ? "alert" : "status"}
      aria-busy={state === "loading" || undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border-control/50 bg-white/45 px-6 py-10 text-center",
        className,
      )}
    >
      <Icon className={cn("size-8", preset.tone, state === "loading" && "animate-spin")} aria-hidden />
      <p className="max-w-prose text-card-title font-semibold">{title ?? preset.title}</p>
      {children ? <div className="max-w-prose text-ink-muted">{children}</div> : null}
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-input bg-surface-subtle", className)} aria-hidden />;
}
