// Client-side store for the cookie-banner choice (GDPR-03).
//
// The choice lives in BOTH a first-party cookie (so server code / Netlify
// can see it if ever needed) and localStorage (fast synchronous read to
// decide whether to show the banner). A logged-in "Accept all" also writes
// a consent_events row via POST /api/settings/consent — that call is made
// by the banner component, not here.

export type CookieChoice = "all" | "essential";

const KEY = "braidr.cookie-consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Fired when the choice changes (or the user reopens the banner), so the
// banner and any listeners re-render without a full reload.
export const COOKIE_CONSENT_EVENT = "braidr:cookie-consent";

export function getCookieChoice(): CookieChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "all" || v === "essential" ? v : null;
  } catch {
    return null;
  }
}

export function setCookieChoice(choice: CookieChoice) {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    /* private mode — the cookie below is the fallback record */
  }
  document.cookie = `${KEY}=${choice}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT));
}

// Footer "Cookie preferences" — reopens the banner for a fresh choice.
export function reopenCookieBanner() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  document.cookie = `${KEY}=; path=/; max-age=0`;
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT));
}

export function analyticsAllowed(): boolean {
  return getCookieChoice() === "all";
}
