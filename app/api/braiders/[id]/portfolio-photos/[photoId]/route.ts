import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/response";
import { isHairTexture, type HairTexture } from "@/lib/hair/textures";

// PATCH /api/braiders/:id/portfolio-photos/:photoId — owner tags (or
// untags) one portfolio photo with a texture. A texture specialisation
// becomes "verified" once it has >= 1 tagged photo (DB trigger).
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile)
    return fail("FORBIDDEN", "Braider profile not found or not owned by you.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION_ERROR", "Expected a JSON body.", 422);
  }
  const raw = (body as { texture?: unknown }).texture;
  let texture: HairTexture | null;
  if (raw === null) texture = null;
  else if (typeof raw === "string" && isHairTexture(raw)) texture = raw;
  else return fail("VALIDATION_ERROR", "texture must be one of the four categories, or null.", 422);

  const { data: updated, error } = await supabase
    .from("braider_portfolio_photos")
    .update({ texture })
    .eq("id", params.photoId)
    .eq("braider_id", params.id)
    .select("id, texture")
    .maybeSingle();
  if (error) return fail("INTERNAL_ERROR", "Failed to tag photo.", 500);
  if (!updated) return fail("NOT_FOUND", "No photo with that id.", 404);

  return ok({ id: updated.id, texture: updated.texture });
}

// DELETE /api/braiders/:id/portfolio-photos/:photoId — owner removes one
// of their own portfolio photos (by row id).
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; photoId: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile)
    return fail("FORBIDDEN", "Braider profile not found or not owned by you.", 403);

  const { data: photo } = await supabase
    .from("braider_portfolio_photos")
    .select("id, storage_path")
    .eq("id", params.photoId)
    .eq("braider_id", params.id)
    .maybeSingle();
  if (!photo) return fail("NOT_FOUND", "No photo with that id.", 404);

  const { error } = await supabase
    .from("braider_portfolio_photos")
    .delete()
    .eq("id", params.photoId)
    .eq("braider_id", params.id);
  if (error) return fail("INTERNAL_ERROR", "Failed to remove photo.", 500);

  const admin = createAdminClient();
  await admin.storage.from("portfolio-photos").remove([photo.storage_path]);

  return ok({ deleted: true });
}
