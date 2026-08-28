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
  useSubscribeBraidcare,
} from "@/lib/hooks/braidcare";
import { ApiError } from "@/lib/api/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { OVERALL_STATUS_META, type BraidcareBookingRow } from "@/lib/types/braidcare";

function BookingCard({ row, subscribed }: { row: BraidcareBookingRow; subscribed: boolean }) {
  const router = useRouter();
  const start = useStartBraidcareSession();
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

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-plum">{row.service_name}</h3>
          <p className="text-sm text-slate">
            with {row.braider_name} · {formatDateTime(row.appointment_at)}
          </p>
        </div>
        <Badge tone={row.window_open || subscribed ? "braidcare" : "neutral"}>
          {subscribed ? "Unlimited" : `${row.sessions_used}/${row.sessions_allocated} used`}
        </Badge>
      </div>

      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}

      <div className="mt-4">
        {!row.window_open && !subscribed ? (
          <p className="text-sm text-slate">
            Your BraidCare check unlocks 24 hours before your appointment on{" "}
            {formatDate(row.appointment_at)}.
          </p>
        ) : row.can_start ? (
          <Button size="sm" className="sm:!w-auto" loading={start.isPending} onClick={startSession}>
            Start a scalp health check
          </Button>
        ) : (
          <p className="text-sm text-slate">
            You&rsquo;ve used all 3 checks for this booking. Subscribe for unlimited checks.
          </p>
        )}
      </div>
    </Card>
  );
}

function BraidcareOverviewScreen() {
  const { data, isLoading, isError } = useBraidcareOverview();
  const subscribe = useSubscribeBraidcare();
  const startStandalone = useStartBraidcareSession();
  const router = useRouter();
  const [subError, setSubError] = useState<string | null>(null);

  async function onSubscribe() {
    setSubError(null);
    try {
      const { checkout_url } = await subscribe.mutateAsync();
      window.location.href = checkout_url;
    } catch (err) {
      setSubError(err instanceof ApiError ? err.message : "Couldn't start checkout.");
    }
  }

  async function onStartStandalone() {
    setSubError(null);
    try {
      const { session } = await startStandalone.mutateAsync(undefined);
      router.push(`/braidcare/sessions/${session.id}`);
    } catch (err) {
      setSubError(err instanceof ApiError ? err.message : "Couldn't start a check.");
    }
  }

  if (isLoading) return <LoadingBlock label="Loading BraidCare" />;
  if (isError || !data) return <Alert tone="error">Couldn&rsquo;t load BraidCare.</Alert>;

  const subscribed = data.client_subscribed;
  const completed = data.sessions.filter((s) => s.status === "completed");
  const inProgress = data.sessions.filter(
    (s) => s.status === "pending" || s.status === "in_progress"
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="BraidCare"
        subtitle="Free with every booking. Unlimited with a subscription."
      />

      <BraidcareDisclaimer />

      {/* Subscription */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Unlimited BraidCare</CardTitle>
          {subscribed ? (
            <Badge tone="braidcare">Active</Badge>
          ) : (
            <span className="text-sm text-slate">£7.99 / month</span>
          )}
        </div>
        <p className="mt-2 text-sm text-slate">
          {subscribed
            ? data.subscription_period_end
              ? `You have unlimited BraidCare access. Renews ${formatDate(data.subscription_period_end)}.`
              : "You have unlimited BraidCare access."
            : "BraidCare unlocks free with your next booking — or subscribe for unlimited access anytime, no booking required."}
        </p>
        {subError && (
          <Alert tone="error" className="mt-3">
            {subError}
          </Alert>
        )}
        {subscribed ? (
          <Button
            size="sm"
            className="mt-3 sm:!w-auto"
            loading={startStandalone.isPending}
            onClick={onStartStandalone}
          >
            Start a scalp health check
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3 sm:!w-auto"
            loading={subscribe.isPending}
            onClick={onSubscribe}
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

      {/* Bookings */}
      <section>
        <h2 className="mb-3 font-display text-lg text-plum">Your bookings</h2>
        {data.bookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-mist bg-white/60 p-8 text-center">
            <p className="font-medium text-plum">No upcoming bookings</p>
            <p className="mt-1 text-sm text-slate">
              {subscribed
                ? "Your subscription covers BraidCare with no booking needed — start a check above."
                : "BraidCare unlocks free 24 hours before a paid appointment."}
            </p>
            {!subscribed && (
              <Link
                href="/braiders"
                className="mt-3 inline-block text-sm font-medium text-teal-deep underline hover:text-plum"
              >
                Find a braider
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.bookings.map((row) => (
              <BookingCard key={row.booking_id} row={row} subscribed={subscribed} />
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
