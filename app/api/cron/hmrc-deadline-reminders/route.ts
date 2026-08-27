import { createAdminClient } from "@/lib/supabase/admin";
import { runHmrcDeadlineReminders } from "@/lib/cron/hmrc-deadline-reminders";
import { ok, fail } from "@/lib/api/response";

// GET /api/cron/hmrc-deadline-reminders — PRD FR-PRO-03.5. Not scheduled
// directly — see /api/cron/release-payouts's comment on why. Kept for
// manual/curl invocation when debugging.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return fail("UNAUTHENTICATED", "Not authorized.", 401);
  }

  try {
    const result = await runHmrcDeadlineReminders(createAdminClient());
    return ok(result);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Failed to send reminders.",
      500
    );
  }
}
