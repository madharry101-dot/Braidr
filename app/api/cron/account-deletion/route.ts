import { createAdminClient } from "@/lib/supabase/admin";
import { runAccountDeletion } from "@/lib/cron/account-deletion";
import { ok, fail } from "@/lib/api/response";

// GET /api/cron/account-deletion — GDPR-08. Hard-deletes accounts 30 days
// after a deletion request (when there's no financial history to retain).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return fail("UNAUTHENTICATED", "Not authorized.", 401);
  }
  try {
    return ok(await runAccountDeletion(createAdminClient()));
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}
