import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

// GET /api/braiders/:id — TRD 4.3: "Get single braider profile with
// services and reviews". Three separate queries rather than embedded
// selects — see the search route's comment on why (empty Relationships).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: braider } = await supabase
    .from("braider_profiles")
    .select(
      "id, user_id, bio, specialisations, city, area, years_experience, is_verified, braidcare_badge_active, avg_rating, total_reviews"
    )
    .eq("id", params.id)
    .single();

  if (!braider) return fail("BRAIDER_NOT_FOUND", "Braider not found.", 404);

  // public_profiles, not profiles — see 20260911000001. A public profile
  // page needs a name and an avatar, nothing else from that row.
  const { data: profile } = await supabase
    .from("public_profiles")
    .select("name, avatar_url")
    .eq("id", braider.user_id)
    .maybeSingle();

  const [{ data: services }, { data: reviews }, { data: photos }, { data: textures }] =
    await Promise.all([
      supabase
        .from("services")
        .select("id, name, category, price_from, price_to, duration_mins, description")
        .eq("braider_id", braider.id)
        .eq("is_active", true),
      supabase
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("braider_id", braider.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("braider_portfolio_photos")
        .select("storage_path, sort_order")
        .eq("braider_id", braider.id)
        .order("sort_order", { ascending: true }),
      // Only VERIFIED specialisations are ever shown to clients.
      supabase
        .from("braider_texture_specialisations")
        .select("texture")
        .eq("braider_id", braider.id)
        .eq("is_verified", true),
    ]);

  const braiderWithName = {
    ...braider,
    name: profile?.name ?? "Braidr braider",
    avatar_url: profile?.avatar_url ?? null,
    portfolio_photos: (photos ?? []).map((p) => p.storage_path),
    verified_textures: (textures ?? []).map((t) => t.texture),
  };

  return ok({ braider: braiderWithName, services: services ?? [], reviews: reviews ?? [] });
}
