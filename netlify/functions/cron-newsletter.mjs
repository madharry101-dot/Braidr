// Scheduled drain of the newsletter send queue. Every 15 minutes: an email
// announcing a new article should land promptly, and each batch is small.
export const config = { schedule: "*/15 * * * *" };

export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/newsletter`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const body = await res.text();
  console.log(`[cron newsletter] ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};
