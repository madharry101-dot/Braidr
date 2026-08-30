import { forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Braidr brand buttons. Approved component library, Section A.
 *
 * Every button: radius-full, 48px minimum height, 12px/24px minimum
 * padding, Inter 600. Gold is capped at one instance per section — it is
 * the loudest thing on any screen it appears on.
 *
 * Styling lives in the .br-btn* classes in app/globals.css, which are the
 * approved source of truth. Nothing here re-declares a token.
 */

export type BrButtonVariant = "primary" | "ghost" | "ghost-inv" | "gold" | "danger";
export type BrButtonSize = "md" | "sm";

const VARIANT: Record<BrButtonVariant, string> = {
  primary: "br-btn-primary",
  ghost: "br-btn-ghost",
  "ghost-inv": "br-btn-ghost-inv",
  gold: "br-btn-gold",
  danger: "br-btn-danger",
};

function classesFor(variant: BrButtonVariant, size: BrButtonSize, className?: string) {
  return cn("br-btn", VARIANT[variant], size === "sm" && "br-btn-sm", className);
}

type BrButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BrButtonVariant;
  size?: BrButtonSize;
  /** Renders the spinner and disables the button. */
  loading?: boolean;
};

export const BrButton = forwardRef<HTMLButtonElement, BrButtonProps>(function BrButton(
  { variant = "primary", size = "md", loading, disabled, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classesFor(variant, size, className)}
      {...props}
    >
      {loading && <Loader2 size={18} aria-hidden="true" className="br-spin" />}
      {children}
    </button>
  );
});

type BrLinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: BrButtonVariant;
  size?: BrButtonSize;
};

/** A button-styled navigation link. Use whenever the action is a route change. */
export function BrLinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: BrLinkButtonProps) {
  return (
    <Link className={classesFor(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

/**
 * Square icon-only button. Keeps the 44px minimum touch target that a
 * bare icon would otherwise lose. `aria-label` is required.
 */
export const BrIconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: BrButtonVariant;
    "aria-label": string;
  }
>(function BrIconButton({ variant = "ghost", className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn("br-btn br-btn-sm", VARIANT[variant], "min-w-[44px] !p-3", className)}
      {...props}
    >
      {children}
    </button>
  );
});
