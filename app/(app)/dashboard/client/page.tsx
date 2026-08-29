"use client";

import { LinkButton } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ReferralCard } from "@/components/referral/referral-card";
import { useSession } from "@/lib/hooks/use-session";

export default function ClientDashboard() {
  const { data: session } = useSession();
  const name = session?.profile?.display_name ?? session?.profile?.full_name ?? "there";

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${name}`}
        subtitle="Find a braider and keep your scalp healthy between appointments."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Book a braider</CardTitle>
          <p className="mt-2 text-sm text-slate">
            Browse verified braiders near you, compare styles and prices, and book in a few taps.
          </p>
          <LinkButton href="/braiders" className="mt-4" size="sm">
            Search braiders
          </LinkButton>
        </Card>

        <Card>
          <CardTitle>BraidCare</CardTitle>
          <p className="mt-2 text-sm text-slate">
            Scalp health monitoring unlocks 24 hours before your appointment, with 3 sessions per
            booking.
          </p>
          <LinkButton href="/braidcare" variant="secondary" className="mt-4" size="sm">
            View BraidCare
          </LinkButton>
        </Card>
      </div>

      <div className="mt-4">
        <ReferralCard role="client" />
      </div>
    </div>
  );
}
