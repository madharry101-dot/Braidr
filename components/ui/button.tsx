import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-teal";

const variants: Record<Variant, string> = {
  primary: "bg-plum text-white hover:bg-plum-hover",
  secondary: "bg-white text-plum border border-mist hover:bg-cream",
  ghost: "bg-transparent text-teal-deep hover:bg-mist/50",
  danger: "bg-danger text-white hover:opacity-90",
};

// PRD 6.4 / WCAG 2.5.5 — every size is at least 44px tall on touch.
const sizes: Record<Size, string> = {
  sm: "min-h-[44px] px-3 text-sm",
  md: "min-h-[44px] px-4 text-sm",
  lg: "min-h-[48px] px-6 text-base",
};

type CommonProps = { variant?: Variant; size?: Size; className?: string };

type ButtonProps = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, loading, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], "w-full xs:w-auto", className)}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

type LinkButtonProps = CommonProps & React.ComponentProps<typeof Link> & { fullWidth?: boolean };

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  fullWidth,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth ? "w-full" : "w-full xs:w-auto",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
