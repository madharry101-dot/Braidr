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

  const rows = disputes ?? [];
  const [{ data: services }, { data: braiderProfiles }] = await Promise.all([
    admin
      .from("services")
      .select("id, name")
      .in(
        "id",
        rows.map((d) => d.service_id)
      ),
    admin
      .from("braider_profiles")
      .select("id, user_id")
      .in(
        "id",
        rows.map((d) => d.braider_id)
      ),
  ]);
  const braiderUser = new Map((braiderProfiles ?? []).map((b) => [b.id, b.user_id]));
  const { data: people } = await admin
    .from("profiles")
    .select("id, display_name, full_name")
    .in("id", [...rows.map((d) => d.client_id), ...(braiderProfiles ?? []).map((b) => b.user_id)]);
  const name = new Map((people ?? []).map((p) => [p.id, p.display_name ?? p.full_name]));
  const serviceName = new Map((services ?? []).map((s) => [s.id, s.name]));

  return ok({
    disputes: rows.map((d) => ({
      ...d,
      service_name: serviceName.get(d.service_id) ?? "Service",
      client_name: name.get(d.client_id) ?? "Client",
      braider_name: name.get(braiderUser.get(d.braider_id) ?? "") ?? "Braider",
    })),
  });
}
