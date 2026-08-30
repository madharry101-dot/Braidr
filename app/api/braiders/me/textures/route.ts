import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { setTextureSpecialisationsSchema } from "@/lib/validations/braider";
import { ok, fail } from "@/lib/api/response";

// PUT /api/braiders/me/textures — set the textures the signed-in braider
// specialises in (Part 1). Insert/delete only — is_verified is trigger-
// maintained from tagged portfolio photos, never written here.
export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "braider") {
    return fail("ROLE_MISMATCH", "Only braider accounts have specialisations.", 403);
  }

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!braiderProfile) return fail("NOT_FOUND", "Create your braider profile first.", 409);

  const parsed = validate(setTextureSpecialisationsSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const wanted = new Set(parsed.data.textures);

  const { data: existingRows } = await supabase
    .from("braider_texture_specialisations")
    .select("id, texture")
    .eq("braider_id", braiderProfile.id);
  const existing = new Set((existingRows ?? []).map((r) => r.texture));

  const toAdd = [...wanted].filter((t) => !existing.has(t));
  const toRemove = (existingRows ?? []).filter((r) => !wanted.has(r.texture));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("braider_texture_specialisations")
      .delete()
      .in(
        "id",
        toRemove.map((r) => r.id)
      );
    if (error) return fail("INTERNAL_ERROR", "Failed to update specialisations.", 500);
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("braider_texture_specialisations")
      .insert(toAdd.map((texture) => ({ braider_id: braiderProfile.id, texture })));
    if (error) return fail("INTERNAL_ERROR", "Failed to update specialisations.", 500);
  }

  const { data: rows } = await supabase
    .from("braider_texture_specialisations")
    .select("texture, is_verified")
    .eq("braider_id", braiderProfile.id);

  return ok({ texture_specialisations: rows ?? [] });
}
