import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { createBraiderProfileSchema } from "@/lib/validations/braider";
import { ok, fail } from "@/lib/api/response";

// GET /api/braiders/me — the signed-in braider's own profile plus everything
// the dashboard needs in one round trip. Not in the TRD endpoint table, but
// the braider-side screens have no other way to discover their own
// braider_profiles.id (search/profile endpoints are keyed by that id).
// Returns profile: null when the row hasn't been created yet.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: profileRow } = await supabase
    .from("braider_profiles")
    .select(
      "id, bio, specialisations, city, area, years_experience, is_verified, is_active, braidcare_badge_active, braidcare_subscribed, braidr_pro_subscribed, stripe_account_id, stripe_charges_enabled, avg_rating, total_reviews, verification_note"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profileRow) {
    return ok({ profile: null, services: [], availability_rules: [], blocked_dates: [] });
  }

  const [
    { data: photos },
    { data: textures },
    { data: services },
    { data: rules },
    { data: blocked },
  ] = await Promise.all([
    supabase
      .from("braider_portfolio_photos")
      .select("id, storage_path, texture, sort_order")
      .eq("braider_id", profileRow.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("braider_texture_specialisations")
      .select("texture, is_verified")
      .eq("braider_id", profileRow.id),
    supabase
      .from("services")
      .select("id, name, category, price_from, price_to, duration_mins, description, is_active")
      .eq("braider_id", profileRow.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("braider_availability_rules")
      .select("id, day_of_week, start_time, end_time")
      .eq("braider_id", profileRow.id),
    supabase
      .from("braider_blocked_dates")
      .select("id, blocked_date, reason")
      .eq("braider_id", profileRow.id)
      .gte("blocked_date", new Date().toISOString().slice(0, 10))
      .order("blocked_date", { ascending: true }),
  ]);

  return ok({
    profile: {
      ...profileRow,
      portfolio_photos: (photos ?? []).map((p) => ({
        id: p.id,
        storage_path: p.storage_path,
        texture: p.texture,
      })),
      texture_specialisations: textures ?? [],
    },
    services: services ?? [],
    availability_rules: rules ?? [],
    blocked_dates: blocked ?? [],
  });
}

// POST /api/braiders/me — create the braider_profiles row for the current
// user. braider_profiles_insert_own RLS already checks user_id = auth.uid();
// the role check here stops a client-role account from creating one.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "braider") {
    return fail("ROLE_MISMATCH", "Only braider accounts can create a braider profile.", 403);
  }

  const { data: existing } = await supabase
    .from("braider_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return fail("VALIDATION_ERROR", "You already have a braider profile.", 409);

  const parsed = validate(createBraiderProfileSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { data: created, error } = await supabase
    .from("braider_profiles")
    .insert({ user_id: user.id, ...parsed.data })
    .select("id")
    .single();

  if (error || !created) return fail("INTERNAL_ERROR", "Failed to create braider profile.", 500);
  return ok({ id: created.id }, 201);
}
