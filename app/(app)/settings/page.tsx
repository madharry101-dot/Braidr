"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { LoadingBlock } from "@/components/ui/spinner";
import { ProfileSection } from "@/components/settings/profile-section";
import { NotificationsSection } from "@/components/settings/notifications-section";
import { EmailPreferencesSection } from "@/components/settings/email-preferences-section";
import { AccountSection } from "@/components/settings/account-section";
import { BillingSection } from "@/components/settings/billing-section";
import { BraidcareDataSection } from "@/components/settings/braidcare-data-section";
import { PrivacySection } from "@/components/settings/privacy-section";
import { ReferralCard } from "@/components/referral/referral-card";
import { useSettingsProfile } from "@/lib/hooks/settings";

// PRD v2.0 §4.10 — per-role Settings. Shared sections plus links to the
// role's existing management screens rather than duplicating them.
const BRAIDER_LINKS = [
  { href: "/dashboard/braider/profile", label: "Public profile" },
  { href: "/dashboard/braider/services", label: "Services" },
  { href: "/dashboard/braider/availability", label: "Availability" },
  { href: "/dashboard/braider/pro", label: "Braidr Pro" },
  { href: "/dashboard/braider/braidcare", label: "BraidCare Professional" },
];

export default function SettingsPage() {
  const { data: profile, isLoading } = useSettingsProfile();

  if (isLoading || !profile) return <LoadingBlock label="Loading settings" />;
  const role = profile.role;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Settings" subtitle="Your profile, notifications, and account." />

      <ProfileSection />

      {role === "braider" && (
        <Card>
          <CardTitle>Your braider tools</CardTitle>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {BRAIDER_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-teal-deep underline hover:text-plum">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {role === "expert" && (
        <Card>
          <CardTitle>Verification</CardTitle>
          <p className="mt-2 text-sm text-slate">
            Manage your credentials and verification status from your{" "}
            <Link href="/dashboard/expert" className="text-teal-deep underline hover:text-plum">
              expert dashboard
            </Link>
            .
          </p>
        </Card>
      )}

      <NotificationsSection />
      <EmailPreferencesSection />
      {role === "client" && <BraidcareDataSection />}
      <AccountSection email={profile.email} />
      {role !== "expert" && <BillingSection role={role} />}
      <ReferralCard role={role === "admin" ? "client" : role} />
      <PrivacySection />
    </div>
  );
}
