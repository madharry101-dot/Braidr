import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// GET /api/admin/bookings/disputes — TRD 4.8 / PRD FR-ADMIN-01.4.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const admin = createAdminClient();
  const { data: disputes, error } = await admin
    .from("bookings")
    .select(
      "id, client_id, braider_id, service_id, appointment_at, amount_pence, dispute_reason, pre_dispute_status, stripe_payment_intent_id, stripe_transfer_id, created_at"
    )
    .eq("status", "disputed")
    .order("created_at", { ascending: true });
  if (error) return fail("INTERNAL_ERROR", "Failed to load disputes.", 500);
  return ok({ disputes: disputes ?? [] });
}
