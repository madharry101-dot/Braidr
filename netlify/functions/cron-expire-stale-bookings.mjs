// Releases slots held by abandoned (unpaid) bookings. Every 15 minutes —
// the Checkout Session expires after 30 min, so a pending booking older
// than an hour is safe to release, and a tighter cadence keeps popular
// slots from being blocked for long.
export const config = { schedule: "*/15 * * * *" };

export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/expire-stale-bookings`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const body = await res.text();
  console.log(`[cron expire-stale-bookings] ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};
