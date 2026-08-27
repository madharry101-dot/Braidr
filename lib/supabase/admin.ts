import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. BYPASSES ROW-LEVEL SECURITY ENTIRELY.
 *
 * Only ever import this from server-only code that itself independently
 * verifies authorisation before acting — namely:
 *   - Stripe webhook handlers (booking confirmation, subscription state,
 *     income record creation, badge/verification changes)
 *   - Admin API routes, after checking profiles.role === 'admin' in code
 *   - Scheduled/cron jobs (e.g. BraidCare AI retry queue)
 *
 * Never import this into anything reachable from a Client Component, and
 * never use it as a shortcut to skip writing an RLS policy for an ordinary
 * user-facing read/write.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
