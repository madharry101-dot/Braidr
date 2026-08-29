// Scheduled trigger for the 90-day scalp-photo purge (GDPR-04 / Privacy
// Policy §7). Daily at 04:00 UTC is plenty — the route deletes any photo
// older than 90 days, so exact timing doesn't matter.
export const config = { schedule: "0 4 * * *" };

export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/purge-braidcare-photos`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const body = await res.text();
  console.log(`[cron purge-braidcare-photos] ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};
