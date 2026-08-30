import Link from "next/link";
import { CookiePreferencesLink } from "@/components/legal/cookie-preferences-link";
import { HOME_COPY } from "./copy";

/*
 * Marketing footer — approved homepage design.
 *
 * Kept separate from components/brand/site-footer.tsx, which the legal
 * pages still use. Two things carried over from that footer deliberately,
 * because dropping them would be a compliance regression rather than a
 * design change:
 *   • the cookie-preferences control (GDPR-03 — consent must be as easy
 *     to withdraw as it was to give),
 *   • the "© Braidr Ltd" line.
 *
 * ⚠️ OPEN COMPLIANCE QUESTION, carried over from Phase 1 and NOT resolved
 * here: there is still no registered company number / registered office
 * line anywhere in the footer. UK company law generally expects that to
 * be accessible somewhere on a commercial site. Deliberately not invented
 * as placeholder text — this needs a real answer, not a guess.
 */
export function MarketingFooter() {
  return (
    <footer
      style={{ background: "var(--brand-deep)", color: "var(--text-inverse)" }}
      className="pb-10 pt-16"
    >
      <div className="br-wrap">
        <span className="br-wordmark" style={{ padding: 0, fontSize: "1.75rem" }}>
          braidr
        </span>
        <p
          className="br-display mt-5 max-w-[480px] text-3xl"
          style={{ lineHeight: 1.2 }}
        >
          {HOME_COPY.footer.tagline}
        </p>
        <p className="mt-3 text-[0.9375rem]" style={{ color: "rgba(249,244,237,.6)" }}>
          {HOME_COPY.footer.support}
        </p>

        <nav
          aria-label="Footer"
          className="mt-10 flex flex-wrap gap-x-6 gap-y-1 pt-6"
          style={{ borderTop: "1px solid rgba(249,244,237,.14)" }}
        >
          {HOME_COPY.footer.links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="py-2 text-sm hover:underline"
              style={{ color: "rgba(249,244,237,.7)" }}
            >
              {link.label}
            </Link>
          ))}
          {/* Wrapped so it picks up the same muted cream as the links —
              Tailwind preflight gives <button> `color: inherit`. */}
          <span style={{ color: "rgba(249,244,237,.7)" }}>
            <CookiePreferencesLink className="py-2 text-sm hover:underline" />
          </span>
        </nav>

        <p className="mt-6 text-sm" style={{ color: "rgba(249,244,237,.45)" }}>
          © {new Date().getFullYear()} Braidr Ltd
        </p>
      </div>
    </footer>
  );
}
