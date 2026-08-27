import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// GET /api/admin/experts/pending — TRD 4.8 / PRD FR-ADMIN-01.3.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const admin = createAdminClient();
  const { data: pending, error } = await admin
    .from("expert_profiles")
    .select(
      "id, user_id, credentials, specialisation, clinic_name, city, consultation_fee_pence, credential_doc_path, verification_note, created_at"
    )
    .eq("is_verified", false)
    .order("created_at", { ascending: true });
  if (error) return fail("INTERNAL_ERROR", "Failed to load pending experts.", 500);

  const { data: people } = await admin
    .from("profiles")
    .select("id, display_name, full_name")
    .in(
      "id",
      (pending ?? []).map((p) => p.user_id)
    );
  const nameById = new Map((people ?? []).map((p) => [p.id, p.display_name ?? p.full_name]));

  return ok({
    pending: (pending ?? []).map((p) => ({ ...p, name: nameById.get(p.user_id) ?? "Unnamed" })),
  });
}
