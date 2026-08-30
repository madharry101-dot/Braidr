import { forwardRef, useId } from "react";
import { AlertCircle, Check, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Braidr form elements. Approved component library, Section B.
 *
 * Every field carries a real <label>. Inputs sit on cream against sand
 * borders, so they read on both cream page backgrounds and sand card
 * fills. Focus is gold — the same ring used across the whole product.
 *
 * Errors are described in text and linked with aria-describedby, never
 * signalled by colour alone.
 */

type FieldShellProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
};

export function BrFieldShell({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={className}>
      <label className="br-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <span className="br-help" id={`${htmlFor}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="br-err" id={`${htmlFor}-error`}>
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string | null) {
  return cn(hint && !error && `${id}-hint`, error && `${id}-error`) || undefined;
}

/* ── Text input ──────────────────────────────────────────────── */

type BrInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string | null;
  wrapperClassName?: string;
};

export const BrInput = forwardRef<HTMLInputElement, BrInputProps>(function BrInput(
  { label, hint, error, id, className, wrapperClassName, ...props },
  ref
) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  return (
    <BrFieldShell
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      className={wrapperClassName}
    >
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn("br-field", className)}
        {...props}
      />
    </BrFieldShell>
  );
});

/* ── Textarea ────────────────────────────────────────────────── */

type BrTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string | null;
  wrapperClassName?: string;
};

export const BrTextarea = forwardRef<HTMLTextAreaElement, BrTextareaProps>(function BrTextarea(
  { label, hint, error, id, className, wrapperClassName, rows = 3, ...props },
  ref
) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  return (
    <BrFieldShell
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      className={wrapperClassName}
    >
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn("br-field", className)}
        {...props}
      />
    </BrFieldShell>
  );
});

/* ── Select ──────────────────────────────────────────────────── */

type BrSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string | null;
  wrapperClassName?: string;
};

export const BrSelect = forwardRef<HTMLSelectElement, BrSelectProps>(function BrSelect(
  { label, hint, error, id, className, wrapperClassName, children, ...props },
  ref
) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  return (
    <BrFieldShell
      label={label}
      htmlFor={fieldId}
      hint={hint}
      error={error}
      className={wrapperClassName}
    >
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, hint, error)}
          className={cn("br-field appearance-none pr-11", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-[15px]"
          style={{ color: "var(--text-muted)" }}
        />
      </div>
    </BrFieldShell>
  );
});

/* ── Checkbox ────────────────────────────────────────────────── */

export function BrCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  id?: string;
}) {
  const reactId = useId();
  const boxId = id ?? reactId;
  return (
    <div className={cn("flex items-center gap-3", disabled && "opacity-50")}>
      <button
        type="button"
        id={boxId}
        role="checkbox"
        aria-checked={indeterminate ? "mixed" : checked}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn("br-check", (checked || indeterminate) && "br-check-on")}
      >
        {indeterminate ? (
          <Minus size={16} aria-hidden="true" />
        ) : (
          checked && <Check size={16} aria-hidden="true" />
        )}
      </button>
      <label htmlFor={boxId} className="cursor-pointer text-[0.9375rem]">
        {label}
      </label>
    </div>
  );
}

/* ── Radio ───────────────────────────────────────────────────── */

export function BrRadio({
  checked,
  disabled,
  onSelect,
  label,
  id,
}: {
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  label: React.ReactNode;
  id?: string;
}) {
  const reactId = useId();
  const radioId = id ?? reactId;
  return (
    <div className={cn("flex items-center gap-3", disabled && "opacity-50")}>
      <button
        type="button"
        id={radioId}
        role="radio"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => !disabled && onSelect()}
        className={cn("br-radio", checked && "br-radio-on")}
      >
        {checked && <span className="br-radio-dot" />}
      </button>
      <label htmlFor={radioId} className="cursor-pointer text-[0.9375rem]">
        {label}
      </label>
    </div>
  );
}

/* ── File upload zone ────────────────────────────────────────── */

export type BrDropzoneState = "idle" | "active" | "uploading" | "success" | "error";

const DROP_STATE: Record<BrDropzoneState, string> = {
  idle: "",
  active: "br-drop-active",
  uploading: "",
  success: "br-drop-ok",
  error: "br-drop-err",
};

export function BrDropzone({
  state = "idle",
  icon,
  title,
  detail,
  progress,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  state?: BrDropzoneState;
  icon?: React.ReactNode;
  title: string;
  detail?: string;
  /** 0–100. Renders the progress bar when `state` is "uploading". */
  progress?: number;
}) {
  return (
    <div className={cn("br-drop", DROP_STATE[state], className)} {...props}>
      {icon}
      <p className={cn("text-[0.9375rem] font-semibold", Boolean(icon) && "mt-2.5")}>{title}</p>
      {state === "uploading" && typeof progress === "number" && (
        <>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full"
            style={{ background: "var(--brand-sand)" }}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full"
              style={{ width: `${progress}%`, background: "var(--brand-gold)" }}
            />
          </div>
          <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            {Math.round(progress)}%
          </p>
        </>
      )}
      {detail && (
        <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          {detail}
        </p>
      )}
    </div>
  );
}

/* ── Role selector ───────────────────────────────────────────── */

export type BrRoleOption<T extends string> = {
  value: T;
  icon: React.ReactNode;
  title: string;
  description: string;
};

/**
 * The approved replacement for the register page's role dropdown.
 * Gold border plus a gold checkmark marks the selection; the whole card
 * is the target, and the group is a real radiogroup for screen readers.
 */
export function BrRoleSelector<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  options: ReadonlyArray<BrRoleOption<T>>;
  value: T;
  onChange: (next: T) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex flex-col items-stretch gap-4 xs:flex-row", className)}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn("br-role", selected && "br-role-on")}
          >
            <span className="flex items-center justify-between">
              <span style={{ color: selected ? "var(--gold-ink)" : "var(--text-muted)" }}>
                {option.icon}
              </span>
              {selected && (
                <span
                  className="flex h-[22px] w-[22px] items-center justify-center rounded-full"
                  style={{ background: "var(--brand-gold)" }}
                >
                  <Check size={14} aria-hidden="true" style={{ color: "var(--brand-deep)" }} />
                </span>
              )}
            </span>
            <span className="mt-3.5 block text-lg font-semibold">{option.title}</span>
            <span
              className="mt-1.5 block text-sm leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
