import { Shield, Star, Leaf, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * Braidr chips, badges and eyebrows. Approved component library, Section E.
 *
 * Colour carries meaning here and nowhere else in the system:
 * sage is healthy, rust is attention, gold is Braidr's own endorsement.
 * Status chips are filled pills so they stay legible at 12px.
 */

export type BrChipTone = "gold" | "sage" | "sand" | "rust" | "deep" | "price";

const TONE: Record<BrChipTone, string> = {
  gold: "br-chip-gold",
  sage: "br-chip-sage",
  sand: "br-chip-sand",
  rust: "br-chip-rust",
  deep: "br-chip-deep",
  price: "br-chip-price",
};

export function BrChip({
  tone = "sand",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BrChipTone }) {
  return (
    <span className={cn("br-chip", TONE[tone], className)} {...props}>
      {children}
    </span>
  );
}

/**
 * Section label pill. On light surfaces the text uses --gold-ink (EXT-1) so
 * 12px gold clears WCAG AA; `dark` switches to full-strength --brand-gold,
 * which passes on dark backgrounds at 6.4:1.
 */
export function BrEyebrow({
  dark,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { dark?: boolean }) {
  return (
    <span className={cn("br-eyebrow", dark && "br-eyebrow-dark", className)} {...props}>
      {children}
    </span>
  );
}

/* ── Identity badges ─────────────────────────────────────────── */

export function BrVerifiedBadge({ className }: { className?: string }) {
  return (
    <BrChip tone="gold" className={className}>
      <Shield size={12} aria-hidden="true" />
      Verified
    </BrChip>
  );
}

export function BrBraidCareBadge({ className }: { className?: string }) {
  return (
    <BrChip tone="sage" className={className}>
      <Leaf size={12} aria-hidden="true" />
      BraidCare
    </BrChip>
  );
}

export function BrProBadge({ className }: { className?: string }) {
  return (
    <BrChip tone="deep" className={className}>
      <Star size={12} aria-hidden="true" />
      Pro
    </BrChip>
  );
}

export function BrLocationChip({ children }: { children: React.ReactNode }) {
  return (
    <BrChip tone="sand">
      <MapPin size={12} aria-hidden="true" />
      {children}
    </BrChip>
  );
}

/** Price chip — radius-sm, the one chip in the system that is not a pill. */
export function BrPriceChip({ children }: { children: React.ReactNode }) {
  return <BrChip tone="price">{children}</BrChip>;
}

/** Rating readout. `count` is the number of reviews behind the average. */
export function BrStars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-[5px] text-[0.8125rem] font-medium">
      <Star
        size={14}
        aria-hidden="true"
        style={{ color: "var(--brand-gold)", fill: "var(--brand-gold)" }}
      />
      {rating}
      {count !== undefined && (
        <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({count})</span>
      )}
    </span>
  );
}
