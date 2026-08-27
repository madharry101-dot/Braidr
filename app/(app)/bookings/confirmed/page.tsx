"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner, LoadingBlock } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { useBooking } from "@/lib/hooks/braidmatch";
import { formatDateTime, formatMoney } from "@/lib/format";

const PENDING_BOOKING_KEY = "braidr:pending_booking";
const GIVE_UP_MS = 25_000;

function Confirmed() {
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    try {
      setBookingId(sessionStorage.getItem(PENDING_BOOKING_KEY));
    } catch {
      setBookingId(null);
    }
  }, []);

  const { data: booking } = useBooking(bookingId ?? "", {
    refetchInterval: bookingId && !gaveUp ? 2000 : undefined,
  });

  const settled =
    booking?.status === "confirmed" ||
    booking?.status === "completed" ||
    booking?.status === "payment_failed";

  useEffect(() => {
    if (settled && bookingId) {
      try {
        sessionStorage.removeItem(PENDING_BOOKING_KEY);
      } catch {
        /* noop */
      }
    }
  }, [settled, bookingId]);

  useEffect(() => {
    if (!bookingId || settled) return;
    const t = setInterval(() => {
      if (Date.now() - startedAt.current > GIVE_UP_MS) setGaveUp(true);
    }, 2000);
    return () => clearInterval(t);
  }, [bookingId, settled]);

  // No booking id to track — payment likely succeeded, webhook is async.
  if (!bookingId) {
    return (
      <Success title="Payment received">
        <p className="text-slate">
          Thanks — your payment went through. Your booking will appear in{" "}
          <Link href="/bookings" className="underline">
            My bookings
          </Link>{" "}
          once it&rsquo;s confirmed (usually within a minute).
        </p>
        <LinkButton href="/bookings" className="mt-4 sm:!w-auto">
          Go to my bookings
        </LinkButton>
      </Success>
    );
  }

  if (booking?.status === "payment_failed") {
    return (
      <div className="mx-auto max-w-lg py-8">
        <Alert tone="error">
          Your payment didn&rsquo;t go through and the booking wasn&rsquo;t completed. No money has
          been taken. You can try booking again.
        </Alert>
        <LinkButton href="/braiders" variant="secondary" className="mt-4 sm:!w-auto">
          Back to search
        </LinkButton>
      </div>
    );
  }

  if (booking && (booking.status === "confirmed" || booking.status === "completed")) {
    return (
      <Success title="Booking confirmed">
        <Card className="text-left">
          <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
            <dt className="text-slate">When</dt>
            <dd className="text-plum">{formatDateTime(booking.appointment_at)}</dd>
            <dt className="text-slate">Paid</dt>
            <dd className="text-plum">{formatMoney(booking.amount_pence)}</dd>
          </dl>
        </Card>
        <p className="mt-4 text-sm text-slate">
          We&rsquo;ve emailed you a confirmation. BraidCare opens 24 hours before your appointment.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <LinkButton href={`/bookings/${booking.id}`} className="sm:!w-auto">
            View booking
          </LinkButton>
          <LinkButton href="/bookings" variant="secondary" className="sm:!w-auto">
            All bookings
          </LinkButton>
        </div>
      </Success>
    );
  }

  if (gaveUp) {
    return (
      <Success title="Payment received">
        <p className="text-slate">
          Your payment went through. Confirmation is taking a little longer than usual — check{" "}
          <Link href="/bookings" className="underline">
            My bookings
          </Link>{" "}
          in a moment.
        </p>
        <LinkButton href="/bookings" className="mt-4 sm:!w-auto">
          Go to my bookings
        </LinkButton>
      </Success>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <Spinner className="mx-auto h-8 w-8 text-plum" />
      <p className="mt-4 font-display text-xl text-plum">Confirming your booking…</p>
      <p className="mt-1 text-sm text-slate">This only takes a few seconds.</p>
    </div>
  );
}

function Success({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg py-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-2xl text-success">
        ✓
      </div>
      <h1 className="mt-4 font-display text-2xl text-plum">{title}</h1>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Confirmed />
    </Suspense>
  );
}
