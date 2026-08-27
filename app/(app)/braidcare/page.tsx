"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { BraidcareDisclaimer } from "@/components/braidcare/disclaimer";
import {
  useBraidcareOverview,
  useStartBraidcareSession,
  useBuyBraidcare,
} from "@/lib/hooks/braidcare";
import { ApiError } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { OVERALL_STATUS_META, type BraidcareBookingRow } from "@/lib/types/braidcare";

function BookingCard({ row }: { row: BraidcareBookingRow }) {
  const router = useRouter();
  const start = useStartBraidcareSession();
  const buy = useBuyBraidcare();
  const [error, setError] = useState<string | null>(null);

  async function startSession() {
    setError(null);
    try {
      const { session } = await start.mutateAsync(row.booking_id);
      router.push(`/braidcare/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start a session.");
    }
  }

  async function buyOneOff() {
    setError(null);
    try {
      const { checkout_url } = await buy.mutateAsync({
        booking_id: row.booking_id,
        type: "oneoff",
      });
      window.location.href = checkout_url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start checkout.");
    }
  }

  const outOfSessions = row.window_open && row.sessions_remaining <= 0;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-plum">{row.service_name}</h3>
          <p className="text-sm text-slate">
            with {row.braider_name} · {formatDateTime(row.appointment_at)}
          </p>
        </div>
        <Badge tone={row.window_open ? "braidcare" : "neutral"}>
          {row.sessions_used}/{row.sessions_allocated} used
        </Badge>
      </div>

      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}

      <div className="mt-4">
        {!row.window_open ? (
          <p className="text-sm text-slate">
            Opens in {row.hours_until_open}h — 24 hours before your appointment.
          </p>
        ) : row.can_start ? (
          <Button size="sm" className="sm:!w-auto" loading={start.isPending} onClick={startSession}>
            Start a session
          </Button>
        ) : outOfSessions ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate">
              You&rsquo;ve used all included sessions for this booking.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="sm:!w-auto"
              loading={buy.isPending}
              onClick={buyOneOff}
            >
              Buy another session — £9.99
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function BraidcareOverviewScreen() {
  const { data, isLoading, isError } = useBraidcareOverview();
  const buy = useBuyBraidcare();
  const [subError, setSubError] = useState<string | null>(null);

  async function subscribe() {
    setSubError(null);
    const firstBooking = data?.bookings[0]?.booking_id;
    if (!firstBooking) {
      setSubError("You need at least one confirmed booking to subscribe.");
      return;
    }
    try {
      const { checkout_url } = await buy.mutateAsync({
        booking_id: firstBooking,
        type: "subscription",
      });
      window.location.href = checkout_url;
    } catch (err) {
      setSubError(err instanceof ApiError ? err.message : "Couldn't start checkout.");
    }
  }

  if (isLoading) return <LoadingBlock label="Loading BraidCare" />;
  if (isError || !data) return <Alert tone="error">Couldn&rsquo;t load BraidCare.</Alert>;

  const completed = data.sessions.filter((s) => s.status === "completed");
  const inProgress = data.sessions.filter(
    (s) => s.status === "pending" || s.status === "in_progress"
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="BraidCare"
        subtitle="Observational scalp health checks between appointments. Three sessions per booking."
      />

      <BraidcareDisclaimer />

      {/* Subscription */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Unlimited BraidCare</CardTitle>
          {data.client_subscribed ? (
            <Badge tone="braidcare">Active</Badge>
          ) : (
            <span className="text-sm text-slate">£7.99 / month</span>
          )}
        </div>
        <p className="mt-2 text-sm text-slate">
          {data.client_subscribed
            ? "You have unlimited sessions across all your bookings."
            : "Unlimited sessions across every booking, cancel anytime."}
        </p>
        {subError && (
          <Alert tone="error" className="mt-3">
            {subError}
          </Alert>
        )}
        {!data.client_subscribed && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3 sm:!w-auto"
            loading={buy.isPending}
            onClick={subscribe}
          >
            Subscribe
          </Button>
        )}
      </Card>

      {/* In-progress sessions */}
      {inProgress.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg text-plum">Continue</h2>
          <div className="flex flex-col gap-3">
            {inProgress.map((s) => (
              <Link
                key={s.id}
                href={`/braidcare/sessions/${s.id}`}
                className="flex items-center justify-between rounded-lg border border-mist bg-surface p-4 shadow-card hover:border-plum"
              >
                <span className="text-sm text-plum">Session {s.session_number}</span>
                <Badge tone={s.status === "in_progress" ? "verified" : "neutral"}>
                  {s.status === "in_progress" ? "Analysing" : "Add photos"}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Eligible bookings */}
      <section>
        <h2 className="mb-3 font-display text-lg text-plum">Your bookings</h2>
        {data.bookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-mist bg-white/60 p-8 text-center">
            <p className="font-medium text-plum">No confirmed bookings</p>
            <p className="mt-1 text-sm text-slate">
              BraidCare unlocks 24 hours before a paid appointment.
            </p>
            <Link
              href="/braiders"
              className="mt-3 inline-block text-sm font-medium text-teal-deep underline hover:text-plum"
            >
              Find a braider
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.bookings.map((row) => (
              <BookingCard key={row.booking_id} row={row} />
            ))}
          </div>
        )}
      </section>

      {/* Past reports */}
      {completed.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg text-plum">Past reports</h2>
          <div className="flex flex-col gap-3">
            {completed.map((s) => {
              const meta = s.overall_status ? OVERALL_STATUS_META[s.overall_status] : null;
              return (
                <Link
                  key={s.id}
                  href={`/braidcare/sessions/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-mist bg-surface p-4 shadow-card hover:border-plum"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-plum">
                      Session {s.session_number}
                      {s.report_delivered_at && ` · ${formatDate(s.report_delivered_at)}`}
                    </p>
                    {s.summary && <p className="truncate text-sm text-slate">{s.summary}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.referral_suggested && <Badge tone="plum">Referral</Badge>}
                    {meta && (
                      <Badge
                        tone={
                          meta.tone === "success"
                            ? "braidcare"
                            : meta.tone === "info"
                              ? "neutral"
                              : meta.tone
                        }
                      >
                        {meta.label}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default function BraidcarePage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <BraidcareOverviewScreen />
    </Suspense>
  );
}
