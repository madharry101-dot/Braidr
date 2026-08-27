"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { useAdminReferrals, useCompleteReferral } from "@/lib/hooks/admin";
import { ApiError } from "@/lib/api/client";
import { formatDate, formatMoney } from "@/lib/format";
import type { AdminReferral } from "@/lib/types/admin";

function ReferralCard({ referral }: { referral: AdminReferral }) {
  const complete = useCompleteReferral();
  const [open, setOpen] = useState(false);
  const [feePounds, setFeePounds] = useState("20");
  const [error, setError] = useState<string | null>(null);

  const done = referral.status === "completed";

  async function submit() {
    setError(null);
    const pence = Math.round(parseFloat(feePounds) * 100);
    if (pence < 1500 || pence > 2500) {
      setError("Fee must be between £15 and £25.");
      return;
    }
    try {
      await complete.mutateAsync({ id: referral.id, referral_fee_pence: pence });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't record this.");
    }
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-plum">{referral.expert_name}</h3>
          <p className="text-sm text-slate">
            Referred {formatDate(referral.created_at)} ·{" "}
            {referral.consent_given ? "observations shared" : "no observations shared"}
          </p>
        </div>
        {done ? (
          <Badge tone="braidcare">
            Paid{" "}
            {referral.referral_fee_pence != null ? formatMoney(referral.referral_fee_pence) : ""}
          </Badge>
        ) : (
          <Badge tone="neutral">Open</Badge>
        )}
      </div>

      {!done &&
        (open ? (
          <div className="flex flex-col gap-2 rounded border border-mist bg-white p-3">
            {error && <Alert tone="error">{error}</Alert>}
            <label className="text-sm text-plum">
              Referral fee (£15–25)
              <input
                type="number"
                min={15}
                max={25}
                step="0.01"
                value={feePounds}
                onChange={(e) => setFeePounds(e.target.value)}
                className="mt-1 block w-28 rounded border border-mist px-2 py-1"
              />
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="sm:!w-auto"
                loading={complete.isPending}
                onClick={submit}
              >
                Record completed
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="sm:!w-auto"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="sm:!w-auto"
            onClick={() => setOpen(true)}
          >
            Mark consultation completed
          </Button>
        ))}
    </Card>
  );
}

export default function AdminReferralsPage() {
  const { data: referrals, isLoading, isError } = useAdminReferrals();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expert referrals"
        subtitle="Record completed consultations and the £15–25 partner fee."
      />

      {isLoading && <LoadingBlock />}
      {isError && <Alert tone="error">Couldn&rsquo;t load referrals.</Alert>}
      {referrals && referrals.length === 0 && (
        <p className="text-sm text-slate">No referrals yet.</p>
      )}
      {referrals && referrals.length > 0 && (
        <div className="flex flex-col gap-3">
          {referrals.map((r) => (
            <ReferralCard key={r.id} referral={r} />
          ))}
        </div>
      )}
    </div>
  );
}
