import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// GET /api/admin/braiders/pending — TRD 4.8 / PRD FR-ADMIN-01.2.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const admin = createAdminClient();
  const { data: pending, error } = await admin
    .from("braider_profiles")
    .select("id, user_id, bio, specialisations, city, area, years_experience, created_at")
    .eq("is_verified", false)
    .order("created_at", { ascending: true });
  if (error) return fail("INTERNAL_ERROR", "Failed to load pending braiders.", 500);
  return ok({ pending: pending ?? [] });
}
