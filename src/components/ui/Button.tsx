import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "default" | "compact";

const base =
  "inline-flex items-center justify-center gap-2 rounded-button px-4 font-medium whitespace-nowrap " +
  "transition-colors duration-150 aria-busy:cursor-progress aria-busy:opacity-85 " +
  // Disabled (bukan loading) memakai gaya netral agar teks tetap terbaca, bukan hijau pudar.
  "disabled:not-aria-busy:cursor-not-allowed disabled:not-aria-busy:border disabled:not-aria-busy:border-border " +
  "disabled:not-aria-busy:bg-neutral-bg disabled:not-aria-busy:text-ink-muted";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary bg-linear-to-b from-[#1d7a43] to-primary text-inverse shadow-[0_6px_16px_-6px_rgba(22,101,52,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] hover:from-primary hover:to-primary-hover",
  secondary: "border border-border-control bg-white/70 text-ink backdrop-blur-sm hover:bg-white",
  ghost: "text-primary hover:bg-primary-soft",
  destructive: "bg-error text-inverse hover:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  default: "h-11 text-body",
  // Compact hanya untuk desktop (DS §7.1); hit area tetap dijaga oleh padding.
  compact: "h-9 text-body",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "default") {
  return cn(base, variants[variant], sizes[size]);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** Label proses saat loading, mis. "Menerapkan…" */
  loadingLabel?: string;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "default",
  icon,
  loading = false,
  loadingLabel,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClasses(variant, size), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function ButtonLink({
  variant = "secondary",
  size = "default",
  icon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={cn(buttonClasses(variant, size), className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

type IconButtonProps = ComponentProps<"button"> & {
  /** Nama accessible wajib untuk tombol ikon (DS §12). */
  label: string;
  icon: ReactNode;
};

export function IconButton({ label, icon, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-button border border-white/70 bg-white/70 text-ink backdrop-blur-sm",
        "transition-colors duration-150 hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
