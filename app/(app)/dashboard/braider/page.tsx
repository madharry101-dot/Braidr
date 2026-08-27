"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { TagInput } from "@/components/ui/tag-input";
import { StatusBadge } from "@/components/booking/status-badge";
import { SetupChecklist } from "@/components/braider/setup-checklist";
import { useBraiderMe, useCreateBraiderProfile } from "@/lib/hooks/braider-dashboard";
import { useBookings } from "@/lib/hooks/braidmatch";
import { useSession } from "@/lib/hooks/use-session";
import { ApiError } from "@/lib/api/client";
import { STYLE_OPTIONS, UK_CITIES } from "@/lib/types/braidmatch";
import { formatDateTime } from "@/lib/format";

function CreateProfile() {
  const { data: session } = useSession();
  const create = useCreateBraiderProfile();
  const [city, setCity] = useState(session?.profile?.city ?? "");
  const [area, setArea] = useState("");
  const [specialisations, setSpecialisations] = useState<string[]>([]);
  const [years, setYears] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        city,
        area: area || undefined,
        specialisations: specialisations.length ? specialisations : undefined,
        years_experience: years ? Number(years) : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create your profile.");
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Set up your braider profile"
        subtitle="A few basics to get started — you can add your bio, photos and services next."
      />
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <Select label="City" value={city} onChange={(e) => setCity(e.target.value)} required>
            <option value="">Select your city</option>
            {UK_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input
            label="Area (optional)"
            placeholder="e.g. Peckham"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
          <TagInput
            label="Styles you offer"
            value={specialisations}
            onChange={setSpecialisations}
            suggestions={STYLE_OPTIONS}
          />
          <Input
            label="Years of experience (optional)"
            type="number"
            min={0}
            max={80}
            value={years}
            onChange={(e) => setYears(e.target.value)}
          />
          <Button type="submit" size="lg" loading={create.isPending} disabled={!city}>
            Create profile
          </Button>
        </form>
      </Card>
    </div>
  );
}

export default function BraiderDashboard() {
  const { data: session } = useSession();
  const { data: me, isLoading, isError } = useBraiderMe();
  const { data: bookings } = useBookings();

  const name = session?.profile?.display_name ?? session?.profile?.full_name ?? "there";

  if (isLoading) return <LoadingBlock />;
  if (isError || !me) return <Alert tone="error">Couldn&rsquo;t load your dashboard.</Alert>;
  if (!me.profile) return <CreateProfile />;

  const now = Date.now();
  const upcoming = (bookings ?? [])
    .filter(
      (b) =>
        (b.status === "confirmed" || b.status === "pending") &&
        new Date(b.appointment_at).getTime() >= now
    )
    .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Hi ${name}`} subtitle="Your booking pipeline and business setup." />

      {!me.profile.is_verified && (
        <Alert tone="info">
          Your profile is pending verification. You can set everything up now — you&rsquo;ll appear
          in search once an admin approves it.
          {me.profile.verification_note && (
            <span className="mt-1 block text-slate">Note: {me.profile.verification_note}</span>
          )}
        </Alert>
      )}

      <SetupChecklist me={me} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-plum">Upcoming appointments</h2>
          <Link
            href="/dashboard/braider/bookings"
            className="text-sm font-medium text-teal-deep hover:text-plum"
          >
            View all →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate">No upcoming appointments yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-mist bg-surface p-4 shadow-card hover:border-plum"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-plum">{b.service_name}</p>
                  <p className="truncate text-sm text-slate">
                    {b.client_name ?? "Client"} · {formatDateTime(b.appointment_at)}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/dashboard/braider/profile", title: "Profile", body: "Bio, photos, styles" },
          {
            href: "/dashboard/braider/services",
            title: "Services",
            body: `${me.services.length} listed`,
          },
          {
            href: "/dashboard/braider/availability",
            title: "Hours",
            body: me.availability_rules.length ? "Set" : "Not set",
          },
          {
            href: "/dashboard/braider/payments",
            title: "Payments",
            body: me.profile.stripe_charges_enabled ? "Connected" : "Not connected",
          },
        ].map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full transition-shadow hover:shadow-[0_2px_4px_rgba(45,27,53,0.1),0_8px_24px_rgba(45,27,53,0.1)]">
              <CardTitle className="text-base">{c.title}</CardTitle>
              <p className="mt-1 text-sm text-slate">{c.body}</p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
