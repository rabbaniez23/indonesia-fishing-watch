import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  helper?: ReactNode;
  error?: string | null;
};

/** Input 44px dengan label terlihat di atas, helper/error di bawah (DS §7.2). */
export function TextField({ label, helper, error, className, id, ...rest }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const describedBy = [helper ? helperId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={inputId} className="font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 rounded-input border bg-surface px-3 text-ink placeholder:text-ink-muted",
          error ? "border-error" : "border-border-control",
        )}
        {...rest}
      />
      {helper ? (
        <p id={helperId} className="text-caption text-ink-muted">
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type SelectFieldProps = ComponentProps<"select"> & { label: string; helper?: ReactNode };

export function SelectField({ label, helper, className, id, children, ...rest }: SelectFieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={selectId} className="font-medium">
        {label}
      </label>
      <select
        id={selectId}
        aria-describedby={helper ? `${selectId}-helper` : undefined}
        className="h-11 rounded-input border border-border-control bg-surface px-3 text-ink"
        {...rest}
      >
        {children}
      </select>
      {helper ? (
        <p id={`${selectId}-helper`} className="text-caption text-ink-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

type TextAreaFieldProps = ComponentProps<"textarea"> & { label: string; helper?: ReactNode; error?: string | null };

/** Textarea dengan label terlihat, helper/error di bawah (DS §7.2). */
export function TextAreaField({ label, helper, error, className, id, rows = 4, ...rest }: TextAreaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = [helper ? `${fieldId}-helper` : null, error ? `${fieldId}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={fieldId} className="font-medium">
        {label}
      </label>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("rounded-input border bg-surface px-3 py-2 text-ink", error ? "border-error" : "border-border-control")}
        {...rest}
      />
      {helper ? (
        <p id={`${fieldId}-helper`} className="text-caption text-ink-muted">
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={`${fieldId}-error`} className="text-caption text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
