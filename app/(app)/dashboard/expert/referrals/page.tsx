"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { useExpertReferrals, useReferralSession } from "@/lib/hooks/expert";
import { formatDate } from "@/lib/format";
import { OVERALL_STATUS_META, SEVERITY_META } from "@/lib/types/braidcare";
import type { ExpertReferral } from "@/lib/types/expert";

function FlaggedAreas({ sessionId }: { sessionId: string }) {
  const { data: session, isLoading, isError } = useReferralSession(sessionId);

  if (isLoading) return <p className="mt-3 text-sm text-slate">Loading observations…</p>;
  if (isError || !session)
    return <p className="mt-3 text-sm text-slate">Couldn&rsquo;t load the observations.</p>;

  const meta = session.overall_status ? OVERALL_STATUS_META[session.overall_status] : null;

  return (
    <div className="mt-3 border-t border-mist pt-3">
      {meta && (
        <p className="text-sm">
          <span className="font-medium text-plum">Overall: </span>
          {meta.label}
        </p>
      )}
      {session.summary && <p className="mt-1 text-sm text-slate">{session.summary}</p>}
      {session.condition_flags.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {session.condition_flags.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Badge tone={SEVERITY_META[f.severity].tone}>{SEVERITY_META[f.severity].label}</Badge>
              <span>
                <span className="font-medium text-plum">{f.area}</span>
                <span className="text-slate"> — {f.observation}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate">
        Observational scalp-check data shared with the client&rsquo;s consent. Not a diagnosis.
      </p>
    </div>
  );
}

function ReferralRow({ referral }: { referral: ExpertReferral }) {
  const [open, setOpen] = useState(false);
  const canView = referral.consent_given && referral.braidcare_session_id;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-plum">Referral · {formatDate(referral.created_at)}</p>
          <p className="text-sm text-slate">
            {referral.consent_given
              ? "Client consented to share their scalp-check observations."
              : "No consent to share observations."}
          </p>
        </div>
        <Badge tone={referral.status === "completed" ? "braidcare" : "neutral"}>
          {referral.status === "completed" ? "Completed" : "New"}
        </Badge>
      </div>

      {canView && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 text-sm font-medium text-teal-deep hover:text-plum"
          >
            {open ? "Hide flagged areas" : "View flagged areas"}
          </button>
          {open && <FlaggedAreas sessionId={referral.braidcare_session_id!} />}
        </>
      )}
    </Card>
  );
}

export default function ExpertReferralsPage() {
  const { data: referrals, isLoading, isError } = useExpertReferrals();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Referrals"
        subtitle="Braiding clients who asked to be referred to you."
        action={
          <Link
            href="/dashboard/expert"
            className="text-sm font-medium text-teal-deep hover:text-plum"
          >
            ← Dashboard
          </Link>
        }
      />

      {isLoading && <LoadingBlock />}
      {isError && <Alert tone="error">Couldn&rsquo;t load your referrals.</Alert>}

      {referrals && referrals.length === 0 && (
        <div className="rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
          <p className="font-medium text-plum">No referrals yet</p>
          <p className="mt-1 text-sm text-slate">
            When a client refers themselves to you from a BraidCare report, it appears here.
          </p>
        </div>
      )}

      {referrals && referrals.length > 0 && (
        <div className="flex flex-col gap-3">
          {referrals.map((r) => (
            <ReferralRow key={r.id} referral={r} />
          ))}
        </div>
      )}
    </div>
  );
}
