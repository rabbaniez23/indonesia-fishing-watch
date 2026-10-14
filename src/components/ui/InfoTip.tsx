"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

const WIDTH = 280;
const GUTTER = 12;

/**
 * Penjelasan singkat yang muncul saat tombol ⓘ diklik (bukan hover-only, DS §12).
 * Dipakai untuk menggantikan paragraf penjelasan panjang agar halaman tidak penuh tulisan.
 * Posisi dihitung terhadap viewport supaya tidak keluar layar di ponsel dan mengikuti tombol saat scroll;
 * ditutup dengan klik di luar atau Esc.
 */
export function InfoTip({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const open = style !== null;

  function place() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(WIDTH, window.innerWidth - GUTTER * 2);
    const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, GUTTER), window.innerWidth - width - GUTTER);
    setStyle({ position: "fixed", top: rect.bottom + 6, left, width });
  }

  function toggle() {
    if (open) setStyle(null);
    else place();
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setStyle(null);
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <span ref={ref} className={cn("relative inline-flex align-middle", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Penjelasan: ${label}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={toggle}
        className="inline-flex size-7 items-center justify-center rounded-full text-ink-muted hover:bg-surface-subtle hover:text-primary"
      >
        <Info className="size-4" aria-hidden />
      </button>
      {style ? (
        <span
          id={id}
          role="note"
          style={style}
          className="glass-strong z-50 rounded-button border p-3 text-left text-caption font-normal text-ink shadow-overlay"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
