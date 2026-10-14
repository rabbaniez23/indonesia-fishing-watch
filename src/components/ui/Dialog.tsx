"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "small" | "form";
};

/**
 * Dialog modal berbasis <dialog> native: focus trap & Escape dari browser,
 * fokus dikembalikan ke elemen pemicu saat ditutup (DS §7.7).
 * Klik overlay sengaja tidak menutup agar form yang belum tersimpan tidak hilang.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = "small" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocus.current?.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] glass-strong rounded-card border p-0 text-ink backdrop:bg-ink/30 backdrop:backdrop-blur-sm",
        "backdrop:bg-ink/40",
        size === "small" ? "max-w-[480px]" : "max-w-[640px]",
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border p-6">
        <div className="min-w-0">
          <h2 id={titleId} className="text-section-title font-semibold">
            {title}
          </h2>
          {description ? (
            <div id={descId} className="mt-1 text-ink-muted">
              {description}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup dialog"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-button hover:bg-surface-subtle"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {children ? <div className="p-6">{children}</div> : null}
      {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4">{footer}</div> : null}
    </dialog>
  );
}
