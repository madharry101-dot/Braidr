import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { identifyStyle } from "@/lib/ai/style-match";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ok, fail } from "@/lib/api/response";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // TRD 4.3.1: max 5MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// POST /api/braiders/style-match — TRD 4.3.1. multipart/form-data: photo
// (required), city (optional filter).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const rateLimit = await checkRateLimit("styleMatch", user.id);
  if (!rateLimit.success)
    return fail("RATE_LIMITED", "Too many style match requests. Try again later.", 429);

  const formData = await request.formData();
  const photo = formData.get("photo");
  const city = formData.get("city");

  if (!(photo instanceof File)) {
    return fail("VALIDATION_ERROR", "A photo file is required.", 422, "photo");
  }
  if (!ALLOWED_TYPES.has(photo.type)) {
    return fail("VALIDATION_ERROR", "Photo must be JPEG, PNG, or WEBP.", 422, "photo");
  }
  if (photo.size > MAX_UPLOAD_BYTES) {
    return fail("VALIDATION_ERROR", "Photo must be 5MB or smaller.", 422, "photo");
  }

  const buffer = Buffer.from(await photo.arrayBuffer());
  const result = await identifyStyle(buffer);

  if (result.style_category === "unclear" || result.confidence < 0.5) {
    return ok({
      identified_style: result.style_category,
      style_label: result.style_label,
      confidence: result.confidence,
      matched_braiders: [],
      search_params: null,
    });
  }

  const searchTag = result.search_tags[0] ?? result.style_category.replace("_", " ");

  let query = supabase
    .from("braider_profiles")
    .select("id, user_id, avg_rating, total_reviews")
    .eq("is_active", true)
    .contains("specialisations", [searchTag])
    .limit(10);
  if (typeof city === "string" && city) query = query.eq("city", city);

  const { data: braiders } = await query;
  const braiderIds = (braiders ?? []).map((b) => b.user_id);

  const { data: profiles } = braiderIds.length
    ? await supabase.from("profiles").select("id, display_name, full_name").in("id", braiderIds)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? p.full_name]));

  const matched_braiders = (braiders ?? []).map((b) => ({
    id: b.id,
    display_name: nameById.get(b.user_id) ?? "Braidr braider",
    avg_rating: b.avg_rating,
  }));

  return ok({
    identified_style: result.style_category,
    style_label: result.style_label,
    confidence: result.confidence,
    matched_braiders,
    search_params: { category: result.style_category, style_tags: result.search_tags },
  });
}
