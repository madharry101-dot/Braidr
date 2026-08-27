import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { removeContentSchema } from "@/lib/validations/moderation";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// DELETE /api/admin/content/portfolio/:braider_id/:photo_index —
// TRD/PRD FR-ADMIN-01.6.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { braider_id: string; photo_index: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const index = Number(params.photo_index);
  if (!Number.isInteger(index) || index < 0) {
    return fail("VALIDATION_ERROR", "photo_index must be a non-negative integer.", 422);
  }

  const parsed = validate(removeContentSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { data: braiderProfile } = await admin
    .from("braider_profiles")
    .select("user_id, portfolio_photos")
    .eq("id", params.braider_id)
    .single();
  if (!braiderProfile) return fail("NOT_FOUND", "Braider profile not found.", 404);
  if (index >= braiderProfile.portfolio_photos.length) {
    return fail("NOT_FOUND", "No photo at that index.", 404);
  }

  const photos = [...braiderProfile.portfolio_photos];
  const [removedPath] = photos.splice(index, 1);

  await admin.storage.from("portfolio-photos").remove([removedPath]);
  await admin
    .from("braider_profiles")
    .update({ portfolio_photos: photos })
    .eq("id", params.braider_id);
  await admin.from("content_moderation_log").insert({
    admin_id: user.id,
    target_type: "portfolio_photo",
    target_user_id: braiderProfile.user_id,
    removed_path: removedPath,
    reason: parsed.data.reason,
  });

  return ok({ portfolio_photos: photos });
}
