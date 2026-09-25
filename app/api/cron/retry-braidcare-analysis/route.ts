import { createAdminClient } from "@/lib/supabase/admin";
import { runRetryBraidcareAnalysis } from "@/lib/cron/retry-braidcare-analysis";
import { ok, fail } from "@/lib/api/response";
import { rejectUnauthorisedCron } from "@/lib/cron/auth";

// GET /api/cron/retry-braidcare-analysis — TRD 5.4's "queued; cron retries
// every 15 minutes for up to 4 hours" for whichever attempt the live
// request (POST .../analyse) didn't complete in time. Not scheduled
// directly — see /api/cron/release-payouts's comment on why. Kept for
// manual/curl invocation when debugging.
export async function GET(request: Request) {
  const unauthorised = rejectUnauthorisedCron(request);
  if (unauthorised) return unauthorised;

  try {
    const result = await runRetryBraidcareAnalysis(createAdminClient());
    return ok(result);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Failed to retry analyses.",
      500
    );
  }
}
