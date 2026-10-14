"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type DetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Jenis data, mis. "Sel grid · Jam apparent fishing". */
  subtitle?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Panel detail non-modal (DS §7.7, §6.2):
 * - >= 768px: side sheet kanan maksimum 360px
 * - < 768px: bottom sheet ~55dvh, tombol tutup selalu terlihat
 * Tidak menutupi seluruh peta di desktop; Escape menutup panel.
 */
export function DetailDrawer({ open, onClose, title, subtitle, children, actions, className }: DetailDrawerProps) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside
      aria-labelledby={titleId}
      className={cn(
        "glass-strong fixed inset-x-0 bottom-0 z-40 flex h-[55dvh] flex-col rounded-t-card border",
        "md:absolute md:inset-x-auto md:top-0 md:right-0 md:bottom-0 md:h-auto md:w-full md:max-w-[360px] md:rounded-none md:border-y-0 md:border-r-0",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-section-title font-semibold outline-none">
            {title}
          </h2>
          {subtitle ? <div className="mt-1 text-caption text-ink-muted">{subtitle}</div> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup detail"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-button hover:bg-surface-subtle"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      {actions ? <div className="flex flex-wrap gap-2 border-t border-border p-4">{actions}</div> : null}
    </aside>
  );
}
