import Link from "next/link";
import { Calendar, Check, Leaf, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { BrButton, BrLinkButton } from "./button";
import { BrChip, BrPriceChip, BrStars, BrVerifiedBadge, type BrChipTone } from "./badge";
import { BrImage } from "./image";

/*
 * Braidr cards. Approved component library, Section C.
 *
 * Five card types, each built for one job. The braider card is the unit of
 * BraidMatch. The booking card is the unit of the client dashboard.
 * Nothing later in the product reinvents these.
 */

export function BrCard({
  lift,
  dark,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { lift?: boolean; dark?: boolean }) {
  return (
    <div
      className={cn("br-card", lift && "br-card-lift", dark && "br-card-dark", className)}
      {...props}
    />
  );
}

/* ── Braider card — BraidMatch search result ─────────────────── */

export function BrBraiderCard({
  name,
  speciality,
  location,
  rating,
  reviewCount,
  priceLabel,
  href,
  verified = true,
  imageNote = "Braider at work, hands in frame, natural window light",
  media,
}: {
  name: string;
  speciality: string;
  location: string;
  rating?: number;
  reviewCount?: number;
  priceLabel: string;
  href: string;
  verified?: boolean;
  imageNote?: string;
  /** The braider's portfolio image, once there is one. */
  media?: React.ReactNode;
}) {
  return (
    <article className="br-card br-card-lift">
      <BrImage ratio="4 / 3" radius="none" note={imageNote} media={media} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-xl font-semibold">{name}</h3>
            <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
              {speciality}
            </p>
          </div>
          {verified && <BrVerifiedBadge />}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {rating !== undefined && <BrStars rating={rating} count={reviewCount} />}
          <BrChip tone="sand">{location}</BrChip>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <BrPriceChip>{priceLabel}</BrPriceChip>
          <BrLinkButton href={href} variant="ghost" size="sm">
            View profile
          </BrLinkButton>
        </div>
      </div>
    </article>
  );
}

/* ── Booking card — client dashboard ─────────────────────────── */

export function BrBookingCard({
  braiderName,
  serviceLabel,
  statusLabel,
  statusTone = "sage",
  dateLabel,
  timeLabel,
  braidCareLabel,
  viewHref,
  onMessage,
  avatar,
}: {
  braiderName: string;
  serviceLabel: string;
  statusLabel: string;
  statusTone?: BrChipTone;
  dateLabel: string;
  timeLabel: string;
  braidCareLabel?: string;
  viewHref: string;
  onMessage?: () => void;
  avatar?: React.ReactNode;
}) {
  return (
    <article className="br-card p-5">
      <div className="flex items-center gap-3.5">
        <div
          className="h-[52px] w-[52px] flex-none overflow-hidden rounded-full"
          style={{ background: "var(--brand-sand)" }}
        >
          {avatar}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{braiderName}</h3>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {serviceLabel}
          </p>
        </div>
        <BrChip tone={statusTone}>
          {statusTone === "sage" && <Check size={12} aria-hidden="true" />}
          {statusLabel}
        </BrChip>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <BrChip tone="sand">
          <Calendar size={12} aria-hidden="true" />
          {dateLabel}
        </BrChip>
        <BrChip tone="sand">{timeLabel}</BrChip>
        {braidCareLabel && (
          <BrChip tone="sage">
            <Leaf size={12} aria-hidden="true" />
            {braidCareLabel}
          </BrChip>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <BrLinkButton href={viewHref} size="sm">
          View booking
        </BrLinkButton>
        {onMessage && (
          <BrButton variant="ghost" size="sm" onClick={onMessage}>
            <MessageSquare size={16} aria-hidden="true" />
            Message braider
          </BrButton>
        )}
      </div>
    </article>
  );
}

/* ── BraidCare session card ──────────────────────────────────── */

export type BrCareSessionStatus = "completed" | "open" | "locked" | "flagged";

const CARE_STATUS_TONE: Record<BrCareSessionStatus, BrChipTone> = {
  completed: "deep",
  open: "gold",
  locked: "sand",
  flagged: "rust",
};

export function BrCareSessionCard({
  sessionNumber,
  totalSessions = 3,
  type,
  status,
  statusLabel,
  statusIcon,
  body,
  ctaLabel,
  ctaHref,
  onCta,
}: {
  sessionNumber: number;
  totalSessions?: number;
  type: string;
  status: BrCareSessionStatus;
  statusLabel: string;
  statusIcon?: React.ReactNode;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
}) {
  // Gold is the "act now" signal and is capped at one per section, so only
  // the open session gets it; everything else offers a ghost button.
  const ctaVariant = status === "open" ? "gold" : "ghost";
  return (
    <article className="br-card p-[18px]">
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--text-muted)" }}
        >
          Session {sessionNumber}/{totalSessions}
        </span>
        <BrChip tone={CARE_STATUS_TONE[status]}>
          {statusIcon}
          {statusLabel}
        </BrChip>
      </div>
      <h3 className="mt-3 text-lg font-semibold">{type}</h3>
      <p
        className="mt-1.5 min-h-[42px] text-sm leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        {body}
      </p>
      {ctaLabel && ctaHref && (
        <BrLinkButton href={ctaHref} variant={ctaVariant} size="sm" className="mt-3.5 w-full">
          {ctaLabel}
        </BrLinkButton>
      )}
      {ctaLabel && !ctaHref && onCta && (
        <BrButton variant={ctaVariant} size="sm" onClick={onCta} className="mt-3.5 w-full">
          {ctaLabel}
        </BrButton>
      )}
    </article>
  );
}

/* ── Braidr Pro milestone card ───────────────────────────────── */

export function BrProMilestoneCard({
  step,
  totalSteps = 5,
  title,
  done,
  href,
}: {
  step: number;
  totalSteps?: number;
  title: string;
  done: boolean;
  href?: string;
}) {
  return (
    <article className="br-card flex items-center gap-3.5 p-[18px]">
      <span
        className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[0.9375rem] font-semibold"
        style={{
          background: done ? "var(--brand-sage)" : "var(--brand-sand)",
          color: done ? "var(--text-inverse)" : "var(--text-primary)",
        }}
      >
        {done ? <Check size={18} aria-hidden="true" /> : step}
      </span>
      <div className="flex-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          Step {step} of {totalSteps}
        </p>
      </div>
      {done ? (
        <BrChip tone="sage">Done</BrChip>
      ) : (
        href && (
          <BrLinkButton href={href} size="sm">
            Begin step
          </BrLinkButton>
        )
      )}
    </article>
  );
}

/* ── Notification card ───────────────────────────────────────── */

export function BrNotificationCard({
  icon,
  iconBackground = "var(--brand-gold)",
  iconColor = "var(--brand-deep)",
  title,
  body,
  timestamp,
  href,
  onDismiss,
}: {
  icon: React.ReactNode;
  iconBackground?: string;
  iconColor?: string;
  title: string;
  body: string;
  timestamp: string;
  href?: string;
  onDismiss?: () => void;
}) {
  const heading = href ? (
    <Link href={href} className="hover:underline">
      {title}
    </Link>
  ) : (
    title
  );
  return (
    <article className="br-card flex gap-3.5 p-4">
      <span
        className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full"
        style={{ background: iconBackground, color: iconColor }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[0.9375rem] font-semibold">{heading}</h3>
        <p className="mt-0.5 truncate text-sm" style={{ color: "var(--text-muted)" }}>
          {body}
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          {timestamp}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onDismiss}
          className="h-8 cursor-pointer border-none bg-transparent p-1.5"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </article>
  );
}
