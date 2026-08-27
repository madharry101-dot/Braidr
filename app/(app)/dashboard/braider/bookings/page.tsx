"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingBlock } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/booking/status-badge";
import { useBookings } from "@/lib/hooks/braidmatch";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Booking } from "@/lib/types/braidmatch";

function Row({ booking }: { booking: Booking }) {
  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-mist bg-surface p-4 shadow-card hover:border-plum"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-plum">{booking.service_name}</p>
        <p className="truncate text-sm text-slate">
          {booking.client_name ?? "Client"} · {formatDateTime(booking.appointment_at)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge status={booking.status} />
        <span className="text-sm text-slate">{formatMoney(booking.amount_pence)}</span>
      </div>
    </Link>
  );
}

function Section({ title, items }: { title: string; items: Booking[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-lg text-plum">{title}</h2>
      <div className="flex flex-col gap-3">
        {items.map((b) => (
          <Row key={b.id} booking={b} />
        ))}
      </div>
    </section>
  );
}

export default function BraiderBookingsPage() {
  const { data: bookings, isLoading, isError } = useBookings();
  const now = Date.now();

  if (isLoading) return <LoadingBlock label="Loading bookings" />;
  if (isError) return <Alert tone="error">Couldn&rsquo;t load your bookings.</Alert>;

  const all = bookings ?? [];
  const needsAction = all
    .filter((b) => b.status === "confirmed" && new Date(b.appointment_at).getTime() < now)
    .sort((a, b) => b.appointment_at.localeCompare(a.appointment_at));
  const upcoming = all
    .filter((b) => b.status === "confirmed" && new Date(b.appointment_at).getTime() >= now)
    .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at));
  const other = all
    .filter((b) => !needsAction.includes(b) && !upcoming.includes(b))
    .sort((a, b) => b.appointment_at.localeCompare(a.appointment_at));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Bookings" subtitle="Your appointment pipeline." />

      {all.length === 0 && (
        <div className="rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
          <p className="font-medium text-plum">No bookings yet</p>
          <p className="mt-1 text-sm text-slate">
            Once your profile is verified and set up, confirmed bookings appear here.
          </p>
        </div>
      )}

      {needsAction.length > 0 && (
        <section>
          <h2 className="mb-1 font-display text-lg text-plum">Needs your action</h2>
          <p className="mb-3 text-sm text-slate">
            Mark these complete once the appointment has happened — that starts your 24-hour payout.
          </p>
          <div className="flex flex-col gap-3">
            {needsAction.map((b) => (
              <Row key={b.id} booking={b} />
            ))}
          </div>
        </section>
      )}

      <Section title="Upcoming" items={upcoming} />
      <Section title="Past & cancelled" items={other} />
    </div>
  );
}
