import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/response";

// DELETE /api/braidcare/sessions/:id/photos/:photo_id — PRD FR-CARE-02.10.
// The schema stores photos as a plain array (photo_paths), not as rows with
// their own ids, so :photo_id here is the array index (0-based) — good
// enough for "delete one photo" without adding a child table for it.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; photo_id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const index = Number(params.photo_id);
  if (!Number.isInteger(index) || index < 0) {
    return fail("VALIDATION_ERROR", "photo_id must be a non-negative integer index.", 422);
  }

  const { data: session } = await supabase
    .from("braidcare_sessions")
    .select("id, client_id, status")
    .eq("id", params.id)
    .single();
  if (!session || session.client_id !== user.id)
    return fail("NOT_FOUND", "Session not found.", 404);
  if (session.status !== "pending") {
    return fail("VALIDATION_ERROR", "Photos can only be deleted before analysis.", 422);
  }

  const admin = createAdminClient();
  const { data: full } = await admin
    .from("braidcare_sessions")
    .select("photo_paths")
    .eq("id", params.id)
    .single();
  const paths = full?.photo_paths ?? [];
  if (index >= paths.length) return fail("NOT_FOUND", "No photo at that index.", 404);

  const [removedPath] = paths.splice(index, 1);
  await admin.storage.from("scalp-photos").remove([removedPath]);
  await admin
    .from("braidcare_sessions")
    .update({ photo_paths: paths, photos_count: paths.length })
    .eq("id", params.id);

  return ok({ deleted: true, photos_count: paths.length });
}
