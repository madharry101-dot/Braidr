"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { ExpertProfileForm } from "@/components/expert/expert-profile-form";
import { ReferralCard } from "@/components/referral/referral-card";
import { useMyExpertProfile, useExpertReferrals } from "@/lib/hooks/expert";
import { useSession } from "@/lib/hooks/use-session";
import { formatMoney } from "@/lib/format";

export default function ExpertDashboard() {
  const { data: session } = useSession();
  const { data: expert, isLoading, isError, refetch } = useMyExpertProfile();
  const { data: referrals } = useExpertReferrals(Boolean(expert));

  const name = session?.profile?.display_name ?? session?.profile?.full_name ?? "there";

  if (isLoading) return <LoadingBlock />;
  if (isError) return <Alert tone="error">Couldn&rsquo;t load your expert profile.</Alert>;

  if (!expert) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="Join the expert network"
          subtitle="List your practice for braiding clients who need a scalp health specialist."
        />
        <Card>
          <ExpertProfileForm onDone={() => refetch()} />
        </Card>
      </div>
    );
  }

  const pending = referrals?.filter((r) => r.status === "referred").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Hi ${name}`} subtitle="Your expert profile and referrals." />

      {!expert.is_verified && (
        <Alert tone="info">
          Your profile is under review. We&rsquo;ll email you once it&rsquo;s verified — then it
          appears in the directory and you can receive referrals.
          {expert.verification_note && (
            <span className="mt-1 block text-slate">Reviewer note: {expert.verification_note}</span>
          )}
        </Alert>
      )}

      {expert.is_verified && (
        <Link href="/dashboard/expert/referrals">
          <Card className="transition-shadow hover:shadow-[0_2px_4px_rgba(45,27,53,0.1),0_8px_24px_rgba(45,27,53,0.1)]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Referral inbox</CardTitle>
              {pending > 0 && <Badge tone="plum">{pending} new</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate">
              {referrals?.length
                ? `${referrals.length} referral${referrals.length === 1 ? "" : "s"} total`
                : "No referrals yet"}
            </p>
          </Card>
        </Link>
      )}

      <Link href="/dashboard/expert/blog">
        <Card className="transition-shadow hover:shadow-[0_2px_4px_rgba(45,27,53,0.1),0_8px_24px_rgba(45,27,53,0.1)]">
          <CardTitle className="text-base">Articles</CardTitle>
          <p className="mt-1 text-sm text-slate">
            Write for the hair and scalp health hub, and review other advisors&rsquo; drafts.
          </p>
        </Card>
      </Link>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Your listing</CardTitle>
          {expert.is_verified ? (
            <Badge tone="verified">Verified</Badge>
          ) : (
            <Badge tone="neutral">Pending</Badge>
          )}
        </div>
        <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-slate">Credentials</dt>
          <dd className="text-plum">{expert.credentials}</dd>
          <dt className="text-slate">Location</dt>
          <dd className="text-plum">
            {expert.clinic_name ? `${expert.clinic_name}, ` : ""}
            {expert.city}
          </dd>
          <dt className="text-slate">Specialisations</dt>
          <dd className="text-plum">
            {expert.specialisation.length ? expert.specialisation.join(", ") : "—"}
          </dd>
          <dt className="text-slate">Consultation fee</dt>
          <dd className="text-plum">
            {expert.consultation_fee_pence != null
              ? `from ${formatMoney(expert.consultation_fee_pence)}`
              : "Not listed"}
          </dd>
        </dl>
      </Card>

      <ReferralCard role="expert" />
    </div>
  );
}
