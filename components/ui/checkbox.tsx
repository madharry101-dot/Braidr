import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: React.ReactNode;
  error?: string | null;
  hint?: string;
};

// PRD 6.4 / GDPR Consent Library — consent checkboxes must be unticked by
// default, clearly labelled, and never colour-only for state. The label can
// carry links (Terms / Privacy), so it takes ReactNode.
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, hint, id, className, ...props },
  ref
) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="flex items-start gap-2.5 text-sm text-plum">
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(hint && `${fieldId}-hint`, error && `${fieldId}-error`) || undefined}
          className={cn(
            "mt-0.5 h-5 w-5 flex-shrink-0 rounded border-mist text-teal",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal",
            "aria-[invalid=true]:border-danger",
            className
          )}
          {...props}
        />
        <span>{label}</span>
      </label>
      {hint && (
        <p id={`${fieldId}-hint`} className="pl-[30px] text-sm text-slate">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="flex items-start gap-1 pl-[30px] text-sm text-danger">
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
});
