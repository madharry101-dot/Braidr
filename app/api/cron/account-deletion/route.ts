import { createAdminClient } from "@/lib/supabase/admin";
import { runAccountDeletion } from "@/lib/cron/account-deletion";
import { ok, fail } from "@/lib/api/response";
import { rejectUnauthorisedCron } from "@/lib/cron/auth";

// GET /api/cron/account-deletion — GDPR-08. Hard-deletes accounts 30 days
// after a deletion request (when there's no financial history to retain).
export async function GET(request: Request) {
  const unauthorised = rejectUnauthorisedCron(request);
  if (unauthorised) return unauthorised;
  try {
    return ok(await runAccountDeletion(createAdminClient()));
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}
