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

  const braiderIds = (pending ?? []).map((p) => p.id);
  const [{ data: people }, { data: photos }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, full_name")
      .in(
        "id",
        (pending ?? []).map((p) => p.user_id)
      ),
    admin
      .from("braider_portfolio_photos")
      .select("braider_id, storage_path, sort_order")
      .in("braider_id", braiderIds)
      .order("sort_order", { ascending: true }),
  ]);
  const nameById = new Map((people ?? []).map((p) => [p.id, p.display_name ?? p.full_name]));
  const photosByBraider = new Map<string, string[]>();
  for (const ph of photos ?? []) {
    const arr = photosByBraider.get(ph.braider_id) ?? [];
    arr.push(ph.storage_path);
    photosByBraider.set(ph.braider_id, arr);
  }

  return ok({
    pending: (pending ?? []).map((p) => ({
      ...p,
      portfolio_photos: photosByBraider.get(p.id) ?? [],
      name: nameById.get(p.user_id) ?? "Unnamed",
    })),
  });
}
