// Scheduled trigger — calls the existing Next.js cron route so all the
// logic stays in one place (app/api/cron/release-payouts, lib/cron/*).
// TRD: release a braider's Stripe transfer 24h after the booking is
// marked complete. Daily is enough for this one.
export const config = { schedule: "0 3 * * *" };

export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/release-payouts`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const body = await res.text();
  console.log(`[cron release-payouts] ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};
