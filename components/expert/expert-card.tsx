"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { useCreateReferral } from "@/lib/hooks/expert";
import { ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";
import type { ExpertCard as ExpertCardData } from "@/lib/types/expert";

export function ExpertCard({
  expert,
  referSessionId,
}: {
  expert: ExpertCardData;
  referSessionId?: string;
}) {
  const refer = useCreateReferral();
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await refer.mutateAsync({
        expert_id: expert.id,
        braidcare_session_id: referSessionId,
        consent_given: consent,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send that referral.");
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium text-plum">{expert.credentials}</h3>
        <p className="text-sm text-slate">
          {expert.clinic_name ? `${expert.clinic_name}, ` : ""}
          {expert.city}
        </p>
      </div>

      {expert.specialisation.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {expert.specialisation.map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
        </div>
      )}

      <p className="text-sm text-slate">
        {expert.consultation_fee_pence != null
          ? `Consultation from ${formatMoney(expert.consultation_fee_pence)}`
          : "Contact for consultation fees"}
      </p>

      {done ? (
        <Alert tone="success">
          Referral sent. {consent ? "This specialist can see your flagged areas." : ""} If they
          offer online booking you&rsquo;ll find the link below.
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-2">
          {expert.booking_url && (
            <a
              href={expert.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center rounded border border-mist px-3 text-sm font-medium text-teal-deep hover:border-plum"
            >
              Book directly
            </a>
          )}
          {referSessionId && (
            <Button
              size="sm"
              variant="secondary"
              className="sm:!w-auto"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Cancel" : "Refer me here"}
            </Button>
          )}
        </div>
      )}

      {open && !done && (
        <div className="rounded border border-mist bg-cream p-3">
          {error && (
            <Alert tone="error" className="mb-2">
              {error}
            </Alert>
          )}
          <label className="flex items-start gap-2 text-sm text-plum">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I consent to Braidr sharing the observations from my scalp check with this specialist.
          </label>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="sm:!w-auto" loading={refer.isPending} onClick={submit}>
              Send referral
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate">
            You can send a referral without consent — the specialist will just see that you asked to
            be referred, not your observations.
          </p>
        </div>
      )}
    </Card>
  );
}
