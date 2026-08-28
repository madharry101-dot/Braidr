"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  COOKIE_CONSENT_EVENT,
  getCookieChoice,
  setCookieChoice,
  type CookieChoice,
} from "@/lib/consent/cookie-consent";
import { COOKIES_VERSION } from "@/lib/consent/versions";
import { api } from "@/lib/api/client";

// GDPR-03 (Consent Library) — exact copy. Shown on first visit before any
// analytics cookie is set. "Essential only" must still allow full use of
// the platform. A logged-in choice of "Accept all" also records a
// consent_events row; for a logged-out visitor the first-party cookie is
// the record (they get a consent_events row at registration).
export function CookieBanner() {
  const [choice, setChoice] = useState<CookieChoice | null>(null);
  const [mounted, setMounted] = useState(false);
  const [managing, setManaging] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    setMounted(true);
    setChoice(getCookieChoice());
    const sync = () => setChoice(getCookieChoice());
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
  }, []);

  if (!mounted || choice !== null) return null;

  async function decide(next: CookieChoice) {
    setCookieChoice(next);
    setChoice(next);
    if (next === "all") {
      // Best-effort: 401 for logged-out visitors is expected and ignored.
      try {
        await api.post("/settings/consent", {
          consent_type: "cookies_analytics",
          consent_version: COOKIES_VERSION,
          granted: true,
        });
      } catch {
        /* logged out — cookie is the record */
      }
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-mist bg-white shadow-[0_-4px_16px_rgba(45,27,53,0.08)]">
      <div className="mx-auto max-w-content px-4 py-4 lg:px-8">
        <p className="font-display text-base text-plum">Cookies, kept simple</p>
        <p className="mt-1 text-sm text-slate">
          We use essential cookies to keep Braidr running, and — only with your permission —
          analytics cookies to help us understand how the Platform is used. Read our{" "}
          <Link href="/privacy" className="underline hover:text-plum">
            Privacy Policy
          </Link>{" "}
          for full details.
        </p>

        {managing && (
          <div className="mt-3 flex flex-col gap-2 rounded border border-mist bg-cream p-3 text-sm">
            <label className="flex items-center justify-between gap-3 text-plum">
              <span>
                <span className="font-medium">Essential</span> — required for the Platform to
                function
              </span>
              <input type="checkbox" checked disabled className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between gap-3 text-plum">
              <span>
                <span className="font-medium">Analytics</span> — understand how the Platform is used
              </span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {managing ? (
            <button
              onClick={() => decide(analytics ? "all" : "essential")}
              className="min-h-[44px] rounded bg-plum px-4 text-sm font-medium text-white hover:bg-plum-hover"
            >
              Save preferences
            </button>
          ) : (
            <>
              <button
                onClick={() => decide("all")}
                className="min-h-[44px] rounded bg-plum px-4 text-sm font-medium text-white hover:bg-plum-hover"
              >
                Accept all
              </button>
              <button
                onClick={() => decide("essential")}
                className="min-h-[44px] rounded border border-mist bg-white px-4 text-sm font-medium text-plum hover:bg-cream"
              >
                Essential only
              </button>
              <button
                onClick={() => setManaging(true)}
                className="min-h-[44px] px-3 text-sm font-medium text-teal-deep underline"
              >
                Manage preferences
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
