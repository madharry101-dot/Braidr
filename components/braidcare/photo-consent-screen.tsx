"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api/client";
import { BRAIDCARE_PHOTO_CONSENT_VERSION } from "@/lib/consent/versions";

// GDPR-04 (Consent Library) — exact copy. Shown before the first scalp
// photo is accepted, for every user, every time consent is not currently
// held. Checkbox unticked by default; Continue disabled until ticked.
export function PhotoConsentScreen({
  onConsented,
  onDecline,
}: {
  onConsented: () => void;
  onDecline: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (!agreed) return;
    setPending(true);
    setError(null);
    try {
      await api.post("/settings/consent", {
        consent_type: "braidcare_photo_processing",
        consent_version: BRAIDCARE_PHOTO_CONSENT_VERSION,
        granted: true,
      });
      onConsented();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-lg">
      <h2 className="font-display text-xl text-plum">Before your first BraidCare check</h2>
      <p className="mt-3 text-sm text-slate">
        BraidCare looks at photographs of your scalp to give you general wellness observations —
        things like signs of tension or dryness. It is not a medical diagnosis, and it does not
        replace seeing a doctor or dermatologist.
      </p>
      <p className="mt-2 text-sm text-slate">
        Your photographs are stored privately, are never shown to your braider, and are
        automatically deleted 90 days after upload. You can delete them yourself at any time, and
        you can turn BraidCare off completely whenever you like.
      </p>

      {error && (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      )}

      <div className="mt-4">
        <Checkbox
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          disabled={pending}
          label="I understand and consent to Braidr analysing my scalp photographs for wellness purposes"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          loading={pending}
          disabled={!agreed}
          onClick={accept}
          className="sm:!w-auto"
        >
          Continue to BraidCare
        </Button>
        <button
          type="button"
          onClick={onDecline}
          className="min-h-[44px] text-sm font-medium text-teal-deep underline"
        >
          Not right now
        </button>
      </div>
    </Card>
  );
}
