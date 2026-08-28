"use client";

import { reopenCookieBanner } from "@/lib/consent/cookie-consent";

// Privacy Policy §9 — "manage your cookie preferences at any time via the
// 'Cookie preferences' link in the site footer." Reopens the GDPR-03 banner.
export function CookiePreferencesLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={reopenCookieBanner} className={className}>
      Cookie preferences
    </button>
  );
}
