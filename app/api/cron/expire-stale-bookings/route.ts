import { createAdminClient } from "@/lib/supabase/admin";
import { runExpireStaleBookings } from "@/lib/cron/expire-stale-bookings";
import { ok, fail } from "@/lib/api/response";

// GET /api/cron/expire-stale-bookings — releases the slot held by a
// pending booking whose checkout was abandoned (safety net for a missed
// checkout.session.expired webhook).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return fail("UNAUTHENTICATED", "Not authorized.", 401);
  }
  try {
    return ok(await runExpireStaleBookings(createAdminClient()));
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}
