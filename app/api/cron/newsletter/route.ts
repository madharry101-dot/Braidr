import { sendQueuedNewsletters } from "@/lib/cron/send-newsletter";
import { ok, fail } from "@/lib/api/response";

// GET /api/cron/newsletter — drains the newsletter_sends queue. Triggered
// every 15 minutes by netlify/functions/cron-newsletter.mjs; runnable by
// hand with the CRON_SECRET bearer token.
//
// Frequent because a "we published something" email loses its point if it
// arrives a day late, and batches are small (one post x current subscribers).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return fail("UNAUTHENTICATED", "Not authorized.", 401);
  }

  try {
    return ok(await sendQueuedNewsletters());
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Failed to send newsletters.",
      500
    );
  }
}
