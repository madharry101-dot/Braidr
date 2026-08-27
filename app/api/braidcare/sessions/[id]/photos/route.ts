import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/api/rate-limit";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTOS_PER_SESSION = 6; // PRD FR-CARE-02.3

// POST /api/braidcare/sessions/:id/photos — TRD 4.5. multipart/form-data,
// field name "photos" (repeatable), 1-6 files, owner only, session must
// still be pending (not yet analysed).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const rateLimit = await checkRateLimit("fileUpload", user.id);
  if (!rateLimit.success) return fail("RATE_LIMITED", "Too many uploads. Try again later.", 429);

  const { data: session } = await supabase
    .from("braidcare_sessions")
    .select("id, client_id, status, photos_count")
    .eq("id", params.id)
    .single();
  if (!session || session.client_id !== user.id) {
    return fail("NOT_FOUND", "Session not found.", 404);
  }
  if (session.status !== "pending") {
    return fail("VALIDATION_ERROR", "Photos can only be added before analysis is triggered.", 422);
  }

  const formData = await request.formData();
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File);

  if (files.length === 0)
    return fail("VALIDATION_ERROR", "At least one photo is required.", 422, "photos");
  if (session.photos_count + files.length > MAX_PHOTOS_PER_SESSION) {
    return fail(
      "VALIDATION_ERROR",
      `A session can have at most ${MAX_PHOTOS_PER_SESSION} photos.`,
      422,
      "photos"
    );
  }
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return fail("VALIDATION_ERROR", "Photos must be JPEG, PNG, or WEBP.", 422, "photos");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return fail("VALIDATION_ERROR", "Each photo must be 5MB or smaller.", 422, "photos");
    }
  }

  // Uploaded via the admin client: the scalp-photos bucket's storage RLS
  // requires the path's first folder segment to equal auth.uid(), which the
  // regular session client would satisfy too — using admin here purely so
  // the path convention (braidcare/{user}/{session}/{file}) is enforced by
  // code, not relied on from client input.
  const admin = createAdminClient();
  const uploadedPaths: string[] = [];

  for (const [index, file] of files.entries()) {
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `braidcare/${user.id}/${session.id}/${Date.now()}-${index}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("scalp-photos")
      .upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (uploadError) {
      return fail("INTERNAL_ERROR", `Failed to upload photo: ${uploadError.message}`, 500);
    }
    uploadedPaths.push(path);
  }

  const { data: existing } = await admin
    .from("braidcare_sessions")
    .select("photo_paths")
    .eq("id", session.id)
    .single();

  const { error: updateError } = await admin
    .from("braidcare_sessions")
    .update({
      photo_paths: [...(existing?.photo_paths ?? []), ...uploadedPaths],
      photos_count: session.photos_count + uploadedPaths.length,
    })
    .eq("id", session.id);

  if (updateError) return fail("INTERNAL_ERROR", "Failed to record uploaded photos.", 500);

  return ok({ photos_count: session.photos_count + uploadedPaths.length }, 201);
}
