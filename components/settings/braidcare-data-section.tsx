"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { usePhotoConsent } from "@/lib/hooks/braidcare";
import { api, ApiError } from "@/lib/api/client";
import { BRAIDCARE_PHOTO_CONSENT_VERSION } from "@/lib/consent/versions";

// GDPR-05 (Consent Library) — withdraw scalp-photo processing consent.
export function BraidcareDataSection() {
  const { data, isLoading } = usePhotoConsent();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setPending(true);
    setError(null);
    try {
      await api.post("/settings/consent", {
        consent_type: "braidcare_photo_processing",
        consent_version: BRAIDCARE_PHOTO_CONSENT_VERSION,
        granted: false,
      });
      qc.invalidateQueries({ queryKey: ["braidcare", "photo-consent"] });
      setConfirming(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardTitle>BraidCare data</CardTitle>

      {isLoading ? (
        <p className="mt-2 text-sm text-slate">Loading…</p>
      ) : data?.consented ? (
        <>
          <p className="mt-2 text-sm text-slate">
            You are currently sharing scalp photographs with BraidCare for wellness analysis.
          </p>
          {error && (
            <Alert tone="error" className="mt-3">
              {error}
            </Alert>
          )}
          {confirming ? (
            <div className="mt-3 rounded border border-mist bg-cream p-3 text-sm">
              <p className="text-plum">
                Withdrawing consent stops BraidCare from analysing any new photographs. Your
                existing reports and any photographs already uploaded will remain unless you delete
                them separately. You can give consent again at any time.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  loading={pending}
                  onClick={withdraw}
                  className="sm:!w-auto"
                >
                  Yes, withdraw consent
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="min-h-[44px] text-sm font-medium text-teal-deep underline"
                >
                  Keep it on
                </button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="mt-3 sm:!w-auto"
              onClick={() => setConfirming(true)}
            >
              Withdraw consent
            </Button>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-slate">
          BraidCare is not currently analysing your photographs. You&rsquo;ll be asked to consent
          again the next time you{" "}
          <Link href="/braidcare" className="text-teal-deep underline hover:text-plum">
            start a check
          </Link>
          .
        </p>
      )}

      <p className="mt-3 text-xs text-slate">
        Manage individual session photos from each report on your{" "}
        <Link href="/braidcare" className="underline hover:text-plum">
          BraidCare page
        </Link>
        .
      </p>
    </Card>
  );
}
