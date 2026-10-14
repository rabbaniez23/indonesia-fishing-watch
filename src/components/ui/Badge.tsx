import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export type StatusTone = "success" | "info" | "warning" | "error" | "neutral";

export const toneClasses: Record<StatusTone, string> = {
  success: "text-success bg-success-bg border-success-border",
  info: "text-info bg-info-bg border-info-border",
  warning: "text-warning bg-warning-bg border-warning-border",
  error: "text-error bg-error-bg border-error-border",
  neutral: "text-neutral bg-neutral-bg border-neutral-border",
};

export const toneIcons: Record<StatusTone, typeof Info> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  neutral: CircleHelp,
};

type BadgeProps = {
  tone?: StatusTone;
  /** Status selalu berupa teks; ikon hanya pendamping (DS §3.2). */
  children: ReactNode;
  icon?: ReactNode | false;
  className?: string;
};

export function Badge({ tone = "neutral", children, icon, className }: BadgeProps) {
  const Icon = toneIcons[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-caption font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {icon === false ? null : (icon ?? <Icon className="size-3.5 shrink-0" aria-hidden />)}
      {children}
    </span>
  );
}
