"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock } from "@/components/ui/spinner";
import { RequireBraiderProfile } from "@/components/braider/require-profile";
import { useStartStripeOnboarding } from "@/lib/hooks/braider-dashboard";
import { ApiError } from "@/lib/api/client";
import type { MyBraiderProfile } from "@/lib/types/braidmatch";

function PaymentsInner({ profile }: { profile: MyBraiderProfile }) {
  const params = useSearchParams();
  const qc = useQueryClient();
  const onboard = useStartStripeOnboarding(profile.id);
  const [error, setError] = useState<string | null>(null);

  const justReturned = params.get("onboarded") === "true";

  // Coming back from Stripe: the account.updated webhook that flips
  // stripe_charges_enabled may land a moment later — poll a few times.
  useEffect(() => {
    if (!justReturned || profile.stripe_charges_enabled) return;
    let n = 0;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["braider", "me"] });
      if (++n >= 5) clearInterval(t);
    }, 2000);
    return () => clearInterval(t);
  }, [justReturned, profile.stripe_charges_enabled, qc]);

  async function start() {
    setError(null);
    try {
      const { onboarding_url } = await onboard.mutateAsync();
      window.location.href = onboarding_url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start Stripe onboarding.");
    }
  }

  const state = profile.stripe_charges_enabled
    ? "connected"
    : profile.stripe_account_id
      ? "incomplete"
      : "not_started";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payments"
        subtitle="Braidr uses Stripe to pay you. Clients pay upfront; your payout lands 24 hours after each appointment."
      />

      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-plum">Stripe payouts</h2>
          {state === "connected" && <Badge tone="braidcare">Connected</Badge>}
          {state === "incomplete" && <Badge tone="neutral">Setup incomplete</Badge>}
          {state === "not_started" && <Badge tone="neutral">Not connected</Badge>}
        </div>

        {state === "connected" && (
          <p className="mt-3 text-sm text-slate">
            You&rsquo;re all set to receive payouts. Clients can book you as soon as your profile is
            verified.
          </p>
        )}

        {state === "incomplete" && (
          <>
            <p className="mt-3 text-sm text-slate">
              {justReturned
                ? "Finishing up — this can take a minute. If it doesn't update, continue the Stripe setup below."
                : "Stripe still needs a few more details before you can be paid."}
            </p>
            <Button className="mt-4 sm:!w-auto" loading={onboard.isPending} onClick={start}>
              Continue Stripe setup
            </Button>
          </>
        )}

        {state === "not_started" && (
          <>
            <p className="mt-3 text-sm text-slate">
              Connect a Stripe account to receive payouts. It takes a couple of minutes and you can
              come back to it.
            </p>
            <Button className="mt-4 sm:!w-auto" loading={onboard.isPending} onClick={start}>
              Connect Stripe
            </Button>
          </>
        )}
      </Card>

      <p className="text-xs text-slate">
        Commission is 12% per booking (5% on Braidr Pro). Refunds for client cancellations are
        handled by Braidr from the platform balance.
      </p>
    </div>
  );
}

export default function BraiderPaymentsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <RequireBraiderProfile>
        {(me) => <PaymentsInner profile={me.profile} />}
      </RequireBraiderProfile>
    </Suspense>
  );
}
