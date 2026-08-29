// Scheduled trigger for GDPR-08 account deletion (30 days after request).
// Daily at 02:00 UTC.
export const config = { schedule: "0 2 * * *" };

export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/account-deletion`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const body = await res.text();
  console.log(`[cron account-deletion] ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};
