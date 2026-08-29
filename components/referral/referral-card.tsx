"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { useReferral } from "@/lib/hooks/referral";

// PRD v2.0 FR-REF-01.5 — the Dashboard referral card. Phase 1: link +
// copy/share only, "Rewards coming soon" (FR-REF-01.6, no reward logic).
export function ReferralCard({ role }: { role: "client" | "braider" | "expert" }) {
  const { data, isLoading } = useReferral();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is visible to copy manually */
    }
  }

  async function share() {
    if (!data || typeof navigator.share !== "function") return copy();
    try {
      await navigator.share({ title: "Braidr", url: data.link });
    } catch {
      /* user cancelled */
    }
  }

  return (
    <Card>
      <CardTitle className="text-base">Invite others to Braidr</CardTitle>
      <p className="mt-1 text-sm text-slate">
        {role === "braider"
          ? "Share your link — it doubles as your personal booking page."
          : "Share Braidr with a friend using your personal link."}
      </p>

      {isLoading || !data ? (
        <div className="bg-mist/60 mt-3 h-10 animate-pulse rounded" />
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded border border-mist bg-cream px-3 py-2 text-sm text-plum">
              {data.link}
            </code>
            <button
              onClick={copy}
              className="min-h-[44px] shrink-0 rounded bg-plum px-3 text-sm font-medium text-white hover:bg-plum-hover"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                onClick={share}
                className="min-h-[44px] shrink-0 rounded border border-mist px-3 text-sm font-medium text-plum hover:bg-cream"
              >
                Share
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-slate">Rewards coming soon.</p>
        </>
      )}
    </Card>
  );
}
