import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/response";

// DELETE /api/braiders/:id/portfolio-photos/:photo_index — owner removes
// one of their own portfolio photos. Same array-index convention as
// braidcare photo deletion (see that route's comment).
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; photo_index: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const index = Number(params.photo_index);
  if (!Number.isInteger(index) || index < 0) {
    return fail("VALIDATION_ERROR", "photo_index must be a non-negative integer.", 422);
  }

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id, portfolio_photos")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile)
    return fail("FORBIDDEN", "Braider profile not found or not owned by you.", 403);
  if (index >= braiderProfile.portfolio_photos.length) {
    return fail("NOT_FOUND", "No photo at that index.", 404);
  }

  const photos = [...braiderProfile.portfolio_photos];
  const [removedPath] = photos.splice(index, 1);

  const admin = createAdminClient();
  await admin.storage.from("portfolio-photos").remove([removedPath]);

  const { error } = await supabase
    .from("braider_profiles")
    .update({ portfolio_photos: photos })
    .eq("id", params.id);
  if (error) return fail("INTERNAL_ERROR", "Failed to remove photo.", 500);

  return ok({ portfolio_photos: photos });
}
