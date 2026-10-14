import type { ReactNode } from "react";
import { InfoTip } from "./InfoTip";

type PageHeaderProps = {
  title: string;
  /** Satu kalimat: halaman ini untuk apa. */
  description?: ReactNode;
  /** Penjelasan tambahan di balik tombol ⓘ. */
  info?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, info, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <h1 className="text-[24px] leading-[32px] font-semibold sm:text-page-title">{title}</h1>
          {info ? <InfoTip label={title}>{info}</InfoTip> : null}
        </div>
        {description ? <p className="mt-1 max-w-3xl text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
