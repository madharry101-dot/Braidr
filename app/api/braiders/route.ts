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
  const { city, style, price_max_pence, braidcare_only, verified_only, limit } = parsed.data;

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

  return ok({ braiders: results });
}
