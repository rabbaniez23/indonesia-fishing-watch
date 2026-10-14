import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { InfoTip } from "./InfoTip";

export function Card({ className, ...rest }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "min-w-0 glass rounded-card p-4 sm:p-6",
        className,
      )}
      {...rest}
    />
  );
}

type CardHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Penjelasan tambahan yang disembunyikan di balik tombol ⓘ. */
  info?: ReactNode;
  /** Heading level mengikuti hierarki halaman. */
  as?: "h2" | "h3";
};

export function CardHeader({ title, description, actions, info, as: Heading = "h2" }: CardHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <Heading className="text-section-title font-semibold">{title}</Heading>
          {info ? <InfoTip label={title}>{info}</InfoTip> : null}
        </div>
        {description ? <p className="mt-1 text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
