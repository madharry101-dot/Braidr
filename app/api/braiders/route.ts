import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { braiderSearchSchema } from "@/lib/validations/braider";
import { ok, fail } from "@/lib/api/response";

// GET /api/braiders — TRD 4.3 / PRD FR-MATCH-01.1, 01.3. Filters: city,
// style (specialisations), price, braidcare-enabled, verified.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(braiderSearchSchema, Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.ok) return parsed.response;
  const { city, style, texture, price_max_pence, braidcare_only, verified_only, limit } =
    parsed.data;

  // Texture filter: restrict to braiders VERIFIED for that texture. Resolve
  // the eligible braider ids first (own query — can't embed, empty
  // Relationships).
  let textureVerifiedIds: Set<string> | null = null;
  if (texture) {
    const { data: specRows } = await supabase
      .from("braider_texture_specialisations")
      .select("braider_id")
      .eq("texture", texture)
      .eq("is_verified", true);
    textureVerifiedIds = new Set((specRows ?? []).map((r) => r.braider_id));
    if (textureVerifiedIds.size === 0) return ok({ braiders: [] });
  }

  let query = supabase
    .from("braider_profiles")
    .select(
      "id, user_id, bio, specialisations, city, area, years_experience, is_verified, braidcare_badge_active, avg_rating, total_reviews"
    )
    .eq("is_active", true)
    .limit(limit);

  if (city) query = query.eq("city", city);
  if (style) query = query.contains("specialisations", [style]);
  if (braidcare_only) query = query.eq("braidcare_badge_active", true);
  if (verified_only) query = query.eq("is_verified", true);
  if (textureVerifiedIds) query = query.in("id", [...textureVerifiedIds]);

  const { data: braiders, error } = await query;
  if (error) return fail("INTERNAL_ERROR", "Search failed.", 500);

  let results = braiders ?? [];

  // price_max_pence filters on services, not braider_profiles directly —
  // applied as a second pass rather than a join, since postgrest-js can't
  // type an embedded services() filter here (Relationships is empty — see
  // types/database.ts).
  if (price_max_pence !== undefined && results.length > 0) {
    const braiderIds = results.map((b) => b.id);
    const { data: affordableServices } = await supabase
      .from("services")
      .select("braider_id")
      .in("braider_id", braiderIds)
      .eq("is_active", true)
      .lte("price_from", price_max_pence);
    const idsWithAffordableService = new Set((affordableServices ?? []).map((s) => s.braider_id));
    results = results.filter((b) => idsWithAffordableService.has(b.id));
  }

  // Hydrate each card with the braider's display name / avatar (from
  // profiles — profiles_select_public_braiders_experts makes this readable)
  // and their cheapest active service price. Two bulk queries rather than
  // embedded selects — postgrest-js can't type embeds here (empty
  // Relationships, see types/database.ts), same pattern as style-match.
  if (results.length > 0) {
    const braiderIds = results.map((b) => b.id);
    const userIds = results.map((b) => b.user_id);
    const [{ data: profiles }, { data: services }, { data: verifiedTextures }] = await Promise.all([
      // public_profiles, not profiles — see 20260911000001. Search results
      // need a name and an avatar, not the braider's phone number.
      supabase.from("public_profiles").select("id, name, avatar_url").in("id", userIds),
      supabase
        .from("services")
        .select("braider_id, price_from")
        .in("braider_id", braiderIds)
        .eq("is_active", true),
      // Verified specialisations only — unverified ones are never shown to clients.
      supabase
        .from("braider_texture_specialisations")
        .select("braider_id, texture")
        .in("braider_id", braiderIds)
        .eq("is_verified", true),
    ]);

    const profileByUser = new Map((profiles ?? []).map((p) => [p.id, p]));
    const minPriceByBraider = new Map<string, number>();
    for (const s of services ?? []) {
      const current = minPriceByBraider.get(s.braider_id);
      if (current === undefined || s.price_from < current) {
        minPriceByBraider.set(s.braider_id, s.price_from);
      }
    }
    const texturesByBraider = new Map<string, string[]>();
    for (const t of verifiedTextures ?? []) {
      const arr = texturesByBraider.get(t.braider_id) ?? [];
      arr.push(t.texture);
      texturesByBraider.set(t.braider_id, arr);
    }

    const hydrated = results.map((b) => {
      const p = profileByUser.get(b.user_id);
      return {
        ...b,
        name: p?.name ?? "Braidr braider",
        avatar_url: p?.avatar_url ?? null,
        price_from_pence: minPriceByBraider.get(b.id) ?? null,
        verified_textures: texturesByBraider.get(b.id) ?? [],
      };
    });
    return ok({ braiders: hydrated });
  }

  return ok({ braiders: [] });
}
