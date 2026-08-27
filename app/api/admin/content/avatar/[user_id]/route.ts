import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { removeContentSchema } from "@/lib/validations/moderation";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// DELETE /api/admin/content/avatar/:user_id — TRD/PRD FR-ADMIN-01.6.
// avatar_url isn't necessarily a portfolio-photos-bucket path (no avatar
// upload endpoint was built this sprint either — moderation here acts on
// whatever's set, however it got there), so this only clears the column
// and best-effort removes the object if the path looks like one of ours.
export async function DELETE(request: NextRequest, { params }: { params: { user_id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const parsed = validate(removeContentSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", params.user_id)
    .single();
  if (!target) return fail("NOT_FOUND", "User not found.", 404);
  if (!target.avatar_url)
    return fail("VALIDATION_ERROR", "This user has no avatar to remove.", 422);

  await admin.storage
    .from("avatars")
    .remove([target.avatar_url])
    .catch(() => {});
  await admin.from("profiles").update({ avatar_url: null }).eq("id", params.user_id);
  await admin.from("content_moderation_log").insert({
    admin_id: user.id,
    target_type: "avatar",
    target_user_id: params.user_id,
    removed_path: target.avatar_url,
    reason: parsed.data.reason,
  });

  return ok({ removed: true });
}
