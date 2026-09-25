import { createAdminClient } from "@/lib/supabase/admin";
import { runReleasePayouts } from "@/lib/cron/release-payouts";
import { ok, fail } from "@/lib/api/response";
import { rejectUnauthorisedCron } from "@/lib/cron/auth";

// GET /api/cron/release-payouts — not in the TRD's endpoint table; exists
// because the separate-charges-and-transfers payment model (see the
// booking.complete route comment) needs something to actually trigger the
// braider's Transfer once the 24-hour post-completion hold has passed.
// Not scheduled directly in vercel.json — /api/cron/daily calls
// runReleasePayouts() in-process, to stay within Vercel's cron job count
// limit on the Hobby plan. This route stays for manual/curl invocation
// (with the CRON_SECRET bearer token) when debugging.
export async function GET(request: Request) {
  const unauthorised = rejectUnauthorisedCron(request);
  if (unauthorised) return unauthorised;

  try {
    const result = await runReleasePayouts(createAdminClient());
    return ok(result);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Failed to release payouts.",
      500
    );
  }
}
