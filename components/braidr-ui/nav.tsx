"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { BrLinkButton } from "./button";
import { BrProBadge } from "./badge";
import { useScrolled } from "./use-scrolled";

/*
 * Braidr navigation. Approved component library, Section D.
 *
 * One pill, four states. The nav floats above the page rather than
 * sitting on it, and its centre links are the only thing that changes
 * between logged-out, client and braider. On mobile, authenticated users
 * get a bottom tab bar — never a sidebar.
 *
 * The pill is dark at rest (it sits on the dark hero) and transitions to
 * cream once the hero has scrolled past — motion brief Animation 5, as
 * adapted for this dark-hero homepage variant.
 */

export function BrWordmark({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("br-wordmark", className)} aria-label="Braidr home">
      braidr
    </Link>
  );
}

export type BrNavLink = { label: string; href: string; icon?: React.ReactNode };

type BrPillNavProps = {
  /** Centre links. Empty renders the slim document nav. */
  links?: ReadonlyArray<BrNavLink>;
  /** Right-hand side, e.g. sign-in link plus join CTA, or an account menu. */
  actions?: React.ReactNode;
  ariaLabel: string;
  homeHref?: string;
  /**
   * "hero" — the nav opens flush against a dark hero and transitions to a
   * floating cream pill on scroll (Animation 5).
   * "light" — pages with no dark hero: cream pill from the start, no
   * scroll transition.
   */
  surface?: "hero" | "light";
};

export function BrPillNav({
  links = [],
  actions,
  ariaLabel,
  homeHref = "/",
  surface = "hero",
}: BrPillNavProps) {
  const scrolled = useScrolled(60);
  const onHero = surface === "hero";
  // The wrapper must be a direct child of the page's scroll container for
  // `position: sticky` to have anywhere to stick — do not wrap it.
  return (
    <div
      className={cn(
        "br-navwrap",
        onHero && "br-navwrap-hero",
        onHero && scrolled && "br-navwrap-scrolled"
      )}
    >
      <nav
        className={cn("br-nav", (!onHero || scrolled) && "br-nav-scrolled")}
        aria-label={ariaLabel}
      >
        <BrWordmark href={homeHref} />
        {links.length > 0 && (
          <div className="br-nav-mid">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="br-navlink br-navlink-outline br-nav-collapse"
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>
        )}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </nav>
    </div>
  );
}

/* ── Public nav — not logged in ──────────────────────────────── */

export function BrPublicNav() {
  return (
    <BrPillNav
      ariaLabel="Main"
      links={[
        { label: "Book a braider", href: "/braiders" },
        { label: "List your services", href: "/register?role=braider" },
      ]}
      actions={
        <>
          <Link href="/login" className="br-navlink">
            Sign in
          </Link>
          <BrLinkButton href="/register" size="sm">
            Join Braidr
          </BrLinkButton>
        </>
      }
    />
  );
}

/* ── Account menu trigger, shared by the logged-in variants ──── */

export function BrAccountButton({
  initials,
  name,
  onClick,
  href,
}: {
  initials: string;
  name: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <span
        className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs font-semibold"
        style={{ background: "var(--brand-deep)", color: "var(--text-inverse)" }}
      >
        {initials}
      </span>
      {name}
      <ChevronDown size={15} aria-hidden="true" />
    </>
  );
  if (href) {
    return (
      <Link href={href} className="br-navlink br-navlink-outline">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className="br-navlink br-navlink-outline" aria-haspopup="menu" onClick={onClick}>
      {inner}
    </button>
  );
}

/* ── Logged-in variants ──────────────────────────────────────── */

export function BrClientNav({ account }: { account: React.ReactNode }) {
  return (
    <BrPillNav
      surface="light"
      ariaLabel="Client"
      homeHref="/dashboard/client"
      links={[
        { label: "Find braiders", href: "/braiders" },
        { label: "BraidCare", href: "/braidcare" },
      ]}
      actions={account}
    />
  );
}

export function BrBraiderNav({ account, isPro }: { account: React.ReactNode; isPro?: boolean }) {
  return (
    <BrPillNav
      surface="light"
      ariaLabel="Braider"
      homeHref="/dashboard/braider"
      links={[
        { label: "My bookings", href: "/dashboard/braider/bookings" },
        { label: "My profile", href: "/dashboard/braider/profile" },
      ]}
      actions={
        <>
          {isPro && <BrProBadge />}
          {account}
        </>
      }
    />
  );
}

/* ── Legal / document nav — slim ─────────────────────────────── */

export function BrDocumentNav() {
  return <BrPillNav ariaLabel="Document" surface="light" />;
}

/* ── Mobile bottom tab bar ───────────────────────────────────── */

export type BrTab = { label: string; href: string; icon: React.ReactNode };

export function BrTabBar({
  tabs,
  activeHref,
  ariaLabel,
}: {
  tabs: ReadonlyArray<BrTab>;
  activeHref: string;
  ariaLabel: string;
}) {
  return (
    <nav className="br-tabbar" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = activeHref === tab.href || activeHref.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn("br-tab", active && "br-tab-on")}
            aria-current={active ? "page" : undefined}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
