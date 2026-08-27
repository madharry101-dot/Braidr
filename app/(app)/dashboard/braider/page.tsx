"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader, ComingSoon } from "@/components/ui/page-header";
import { useSession } from "@/lib/hooks/use-session";

export default function BraiderDashboard() {
  const { data: session } = useSession();
  const name = session?.profile?.display_name ?? session?.profile?.full_name ?? "there";

  return (
    <div>
      <PageHeader
        title={`Hi ${name}`}
        subtitle="Your booking pipeline, profile, and income in one place."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle>Bookings</CardTitle>
          <p className="mt-2 text-sm text-slate">Upcoming appointments and requests to confirm.</p>
        </Card>
        <Card>
          <CardTitle>Profile</CardTitle>
          <p className="mt-2 text-sm text-slate">
            Services, portfolio, availability, and Stripe payout setup.
          </p>
        </Card>
        <Card>
          <CardTitle>Braidr Pro</CardTitle>
          <p className="mt-2 text-sm text-slate">
            The 5-step self-employment pathway — HMRC, insurance, banking, growth.
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <ComingSoon note="The braider dashboard widgets are wired to /api/braiders, /api/bookings and /api/pro — the interactive screens land in the next sprint." />
      </div>
    </div>
  );
}
