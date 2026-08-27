// Scheduled trigger for the BraidCare analysis retry loop. TRD 5.4 wants
// this every 15 minutes (up to 4h old) — which Vercel Hobby couldn't do
// but Netlify's free tier can.
export const config = { schedule: "*/15 * * * *" };

export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/retry-braidcare-analysis`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const body = await res.text();
  console.log(`[cron retry-braidcare-analysis] ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};
