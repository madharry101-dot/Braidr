// Scheduled trigger for HMRC Self Assessment deadline reminders
// (PRD FR-PRO-03.5 — 60/30/7 days before 31 Jan and 31 Jul). The route
// itself checks whether today is a reminder day, so a plain daily run at
// 08:00 UTC is all it needs.
export const config = { schedule: "0 8 * * *" };

export default async () => {
  const res = await fetch(`${process.env.URL}/api/cron/hmrc-deadline-reminders`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const body = await res.text();
  console.log(`[cron hmrc-deadline-reminders] ${res.status} ${body}`);
  return new Response(body, { status: res.status });
};
