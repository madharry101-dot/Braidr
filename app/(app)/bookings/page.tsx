"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/booking/status-badge";
import { useBookings } from "@/lib/hooks/braidmatch";
import { useSession } from "@/lib/hooks/use-session";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Booking } from "@/lib/types/braidmatch";

const UPCOMING_STATUSES = new Set(["pending", "confirmed"]);

function BookingRow({ booking, otherParty }: { booking: Booking; otherParty: string }) {
  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-mist bg-surface p-4 shadow-card hover:border-plum"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-plum">{booking.service_name}</p>
        <p className="truncate text-sm text-slate">
          {otherParty} · {formatDateTime(booking.appointment_at)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge status={booking.status} />
        <span className="text-sm text-slate">{formatMoney(booking.amount_pence)}</span>
      </div>
    </Link>
  );
}

export default function BookingsPage() {
  const { data: session } = useSession();
  const { data: bookings, isLoading, isError } = useBookings();

  const isBraider = session?.profile?.role === "braider";
  const otherPartyOf = (b: Booking) => (isBraider ? (b.client_name ?? "Client") : b.braider_name);

  const now = Date.now();
  const upcoming = (bookings ?? [])
    .filter((b) => UPCOMING_STATUSES.has(b.status) && new Date(b.appointment_at).getTime() >= now)
    .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at));
  const past = (bookings ?? [])
    .filter((b) => !upcoming.includes(b))
    .sort((a, b) => b.appointment_at.localeCompare(a.appointment_at));

  return (
    <div>
      <PageHeader
        title="Your bookings"
        action={
          !isBraider ? (
            <LinkButton href="/braiders" size="sm" className="sm:!w-auto">
              Book a braider
            </LinkButton>
          ) : undefined
        }
      />

      {isLoading && <LoadingBlock label="Loading bookings" />}
      {isError && <Alert tone="error">Couldn&rsquo;t load your bookings. Please try again.</Alert>}

      {bookings && bookings.length === 0 && (
        <div className="rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
          <p className="font-medium text-plum">No bookings yet</p>
          {!isBraider && (
            <>
              <p className="mt-1 text-sm text-slate">
                Find a braider and book your first appointment.
              </p>
              <LinkButton href="/braiders" className="mt-4 sm:!w-auto">
                Search braiders
              </LinkButton>
            </>
          )}
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg text-plum">Upcoming</h2>
          <div className="flex flex-col gap-3">
            {upcoming.map((b) => (
              <BookingRow key={b.id} booking={b} otherParty={otherPartyOf(b)} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg text-plum">Past &amp; cancelled</h2>
          <div className="flex flex-col gap-3">
            {past.map((b) => (
              <BookingRow key={b.id} booking={b} otherParty={otherPartyOf(b)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
