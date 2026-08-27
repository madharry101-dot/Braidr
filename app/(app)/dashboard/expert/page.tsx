"use client";

import { PageHeader, ComingSoon } from "@/components/ui/page-header";
import { useSession } from "@/lib/hooks/use-session";

export default function ExpertDashboard() {
  const { data: session } = useSession();
  const name = session?.profile?.display_name ?? session?.profile?.full_name ?? "there";

  return (
    <div>
      <PageHeader
        title={`Hi ${name}`}
        subtitle="Referrals from braiders and clients who need specialist review."
      />
      <ComingSoon note="The Expert Network directory and referral inbox are backed by /api/experts and /api/experts/referrals. Screens arrive with the Expert sprint (PRD Phase 2)." />
    </div>
  );
}
