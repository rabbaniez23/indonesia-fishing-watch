import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { toneClasses, toneIcons, type StatusTone } from "./Badge";

type BannerProps = {
  tone: StatusTone;
  title: string;
  children?: ReactNode;
  /** Tindakan relevan, mis. tombol "Coba lagi" atau tautan status sumber. */
  action?: ReactNode;
  className?: string;
};

/** Banner di atas area data untuk partial/stale/error/demo (DS §7.6). */
export function Banner({ tone, title, children, action, className }: BannerProps) {
  const Icon = toneIcons[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-button border px-4 py-3 sm:flex-row sm:items-start",
        toneClasses[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="text-ink">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
