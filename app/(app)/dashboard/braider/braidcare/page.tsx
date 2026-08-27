"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { RequireBraiderProfile } from "@/components/braider/require-profile";
import { useBraiderClientSessions, useBraiderBraidcareSubscribe } from "@/lib/hooks/braidcare";
import { ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/format";
import {
  OVERALL_STATUS_META,
  SEVERITY_META,
  type BraiderClientSession,
} from "@/lib/types/braidcare";

function Paywall() {
  const subscribe = useBraiderBraidcareSubscribe();
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setError(null);
    try {
      const { checkout_url } = await subscribe.mutateAsync();
      window.location.href = checkout_url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start checkout.");
    }
  }

  return (
    <Card className="max-w-lg">
      <div className="flex items-center justify-between">
        <CardTitle className="text-base">BraidCare Professional</CardTitle>
        <span className="text-sm text-slate">£14.99 / month</span>
      </div>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-slate">
        <li>See the scalp health areas your clients&rsquo; checks flag, between appointments.</li>
        <li>Know when a client may benefit from a rest period before you re-braid.</li>
        <li>Show the BraidCare badge on your profile and in search.</li>
      </ul>
      <p className="mt-3 text-xs text-slate">
        You only ever see observed areas and severity — never client photos or their full report.
      </p>
      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}
      <Button className="mt-4 sm:!w-auto" loading={subscribe.isPending} onClick={go}>
        Subscribe
      </Button>
    </Card>
  );
}

function ClientSessionCard({ session }: { session: BraiderClientSession }) {
  const meta = session.overall_status ? OVERALL_STATUS_META[session.overall_status] : null;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium text-plum">{session.client_name}</h3>
          <p className="text-sm text-slate">
            {session.service_name}
            {session.report_delivered_at && ` · ${formatDate(session.report_delivered_at)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session.referral_suggested && <Badge tone="plum">Referral suggested</Badge>}
          {meta && (
            <Badge
              tone={
                meta.tone === "success" ? "braidcare" : meta.tone === "info" ? "neutral" : meta.tone
              }
            >
              {meta.label}
            </Badge>
          )}
        </div>
      </div>

      {session.condition_flags.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {session.condition_flags.map((flag, i) => {
            const sev = SEVERITY_META[flag.severity];
            return (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge tone={sev.tone}>{sev.label}</Badge>
                <span>
                  <span className="font-medium text-plum">{flag.area}</span>
                  <span className="text-slate"> — {flag.observation}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate">No specific areas flagged.</p>
      )}
    </Card>
  );
}

function BraiderBraidcareInner() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useBraiderClientSessions();

  const justReturned = params.get("subscribed") === "true";
  useEffect(() => {
    if (!justReturned || data?.subscribed) return;
    let n = 0;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["braidcare", "braider-sessions"] });
      if (++n >= 5) clearInterval(t);
    }, 2000);
    return () => clearInterval(t);
  }, [justReturned, data?.subscribed, qc]);

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) return <Alert tone="error">Couldn&rsquo;t load BraidCare.</Alert>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Client BraidCare"
        subtitle="Scalp health areas your clients' checks flagged between appointments."
      />

      {!data.subscribed ? (
        <>
          {justReturned && (
            <Alert tone="info">
              Finishing your subscription — this can take a minute. Refresh if it doesn&rsquo;t
              update.
            </Alert>
          )}
          <Paywall />
        </>
      ) : data.sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
          <p className="font-medium text-plum">No client checks yet</p>
          <p className="mt-1 text-sm text-slate">
            When a client completes a BraidCare check on one of your bookings, their flagged areas
            appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.sessions.map((s) => (
            <ClientSessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BraiderBraidcarePage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <RequireBraiderProfile>{() => <BraiderBraidcareInner />}</RequireBraiderProfile>
    </Suspense>
  );
}
