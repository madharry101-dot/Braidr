import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

const controlBase =
  "min-h-[44px] w-full rounded border border-mist bg-white px-3 py-2 text-plum " +
  "placeholder:text-slate/60 focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-teal aria-[invalid=true]:border-danger";

type FieldWrapProps = {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
};

// PRD 6.4 — label always visible and associated; errors described in text,
// linked to the control via aria-describedby, not signalled by colour alone.
export function Field({ label, htmlFor, error, hint, children }: FieldWrapProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-plum">
        {label}
      </label>
      {hint && (
        <p id={`${htmlFor}-hint`} className="text-sm text-slate">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="flex items-start gap-1 text-sm text-danger">
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  hint?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, ...props },
  ref
) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hint && `${fieldId}-hint`, error && `${fieldId}-error`) || undefined}
        className={cn(controlBase, className)}
        {...props}
      />
    </Field>
  );
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string | null;
  hint?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, id, className, children, ...props },
  ref
) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint}>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hint && `${fieldId}-hint`, error && `${fieldId}-error`) || undefined}
        className={cn(controlBase, "appearance-none bg-white", className)}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
});
