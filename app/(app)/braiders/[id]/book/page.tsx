"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock, Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { useBraider, useAvailability, useCreateBooking } from "@/lib/hooks/braidmatch";
import { ApiError } from "@/lib/api/client";
import { formatMoney, formatDuration, formatTime, formatDayLong, toDateKey } from "@/lib/format";

const WINDOW_DAYS = 21;
const PENDING_BOOKING_KEY = "braidr:pending_booking";

function groupSlotsByDay(slots: string[]) {
  const byDay = new Map<string, string[]>();
  for (const iso of slots) {
    const key = toDateKey(new Date(iso));
    const list = byDay.get(key) ?? [];
    list.push(iso);
    byDay.set(key, list);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function BookingFlow() {
  const { id: braiderId } = useParams<{ id: string }>();
  const serviceId = useSearchParams().get("service") ?? "";

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: braiderData, isLoading: braiderLoading } = useBraider(braiderId);
  const service = braiderData?.services.find((s) => s.id === serviceId);

  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    const to = new Date(now);
    to.setDate(to.getDate() + WINDOW_DAYS);
    return { dateFrom: toDateKey(now), dateTo: toDateKey(to) };
  }, []);

  const {
    data: slots,
    isLoading: slotsLoading,
    isError: slotsError,
  } = useAvailability(braiderId, serviceId, dateFrom, dateTo, Boolean(service));

  const days = useMemo(() => groupSlotsByDay(slots ?? []), [slots]);

  const createBooking = useCreateBooking();

  async function goToPayment() {
    if (!selectedSlot) return;
    setSubmitError(null);
    try {
      const { booking_id, checkout_url } = await createBooking.mutateAsync({
        braider_id: braiderId,
        service_id: serviceId,
        appointment_at: selectedSlot,
      });
      try {
        sessionStorage.setItem(PENDING_BOOKING_KEY, booking_id);
      } catch {
        /* private mode — the confirmed page falls back to the bookings list */
      }
      if (checkout_url) window.location.href = checkout_url;
      else setSubmitError("Couldn't start checkout. Please try again.");
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Couldn't create the booking. Please try again."
      );
    }
  }

  if (braiderLoading) return <LoadingBlock label="Loading" />;

  if (!braiderData || !service) {
    return (
      <Alert tone="error">
        That service could not be found.{" "}
        <Link href={`/braiders/${braiderId}`} className="underline">
          Back to the braider&rsquo;s profile
        </Link>
        .
      </Alert>
    );
  }

  const { braider } = braiderData;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/braiders/${braiderId}`} className="text-sm text-teal-deep hover:text-plum">
        ← {braider.name}
      </Link>

      <PageHeader title="Book an appointment" />

      {/* Service summary */}
      <Card className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-plum">{service.name}</h2>
              <Badge>{service.category}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate">
              {formatDuration(service.duration_mins)} with {braider.name}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl text-plum">{formatMoney(service.price_from)}</p>
            <p className="text-xs text-slate">you pay today</p>
          </div>
        </div>
      </Card>

      {/* Slot picker */}
      <h2 className="font-display text-lg text-plum">Choose a time</h2>
      <div className="mt-3">
        {slotsLoading && <LoadingBlock label="Loading availability" />}
        {slotsError && (
          <Alert tone="error">Couldn&rsquo;t load availability. Please try again.</Alert>
        )}
        {!slotsLoading && !slotsError && days.length === 0 && (
          <div className="rounded-lg border border-dashed border-mist bg-white/60 p-8 text-center">
            <p className="font-medium text-plum">No open slots in the next {WINDOW_DAYS} days</p>
            <p className="mt-1 text-sm text-slate">
              Try another service or check back later — braiders update their availability
              regularly.
            </p>
          </div>
        )}
        {days.length > 0 && (
          <div className="flex flex-col gap-5">
            {days.map(([dayKey, daySlots]) => (
              <div key={dayKey}>
                <h3 className="text-sm font-medium text-slate">{formatDayLong(daySlots[0])}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {daySlots.map((iso) => {
                    const active = selectedSlot === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSelectedSlot(iso)}
                        aria-pressed={active}
                        className={
                          "min-h-[44px] rounded border px-3 text-sm font-medium transition-colors " +
                          (active
                            ? "border-plum bg-plum text-white"
                            : "border-mist bg-white text-plum hover:border-plum")
                        }
                      >
                        {formatTime(iso)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment CTA */}
      <div className="bg-cream/95 sticky bottom-16 mt-8 rounded-lg border border-mist p-4 backdrop-blur md:bottom-0">
        {submitError && (
          <Alert tone="error" className="mb-3">
            {submitError}
          </Alert>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate">
            {selectedSlot ? (
              <>
                <span className="font-medium text-plum">{formatDayLong(selectedSlot)}</span> at{" "}
                <span className="font-medium text-plum">{formatTime(selectedSlot)}</span>
              </>
            ) : (
              "Select a time to continue"
            )}
          </p>
          <Button
            type="button"
            size="lg"
            disabled={!selectedSlot || createBooking.isPending}
            onClick={goToPayment}
            className="sm:!w-auto"
          >
            {createBooking.isPending ? (
              <>
                <Spinner className="h-4 w-4" /> Starting checkout…
              </>
            ) : (
              `Pay ${formatMoney(service.price_from)} & book`
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate">
          Your payment is held securely and released to the braider 24 hours after your appointment.
        </p>
      </div>
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <BookingFlow />
    </Suspense>
  );
}
