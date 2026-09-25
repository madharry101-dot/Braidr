import { createAdminClient } from "@/lib/supabase/admin";
import { runExpireStaleBookings } from "@/lib/cron/expire-stale-bookings";
import { ok, fail } from "@/lib/api/response";
import { rejectUnauthorisedCron } from "@/lib/cron/auth";

// GET /api/cron/expire-stale-bookings — releases the slot held by a
// pending booking whose checkout was abandoned (safety net for a missed
// checkout.session.expired webhook).
export async function GET(request: Request) {
  const unauthorised = rejectUnauthorisedCron(request);
  if (unauthorised) return unauthorised;
  try {
    return ok(await runExpireStaleBookings(createAdminClient()));
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}
