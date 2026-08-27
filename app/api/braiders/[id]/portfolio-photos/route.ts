import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/response";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PORTFOLIO_PHOTOS = 12;

// POST /api/braiders/:id/portfolio-photos — not in the TRD's endpoint
// table; PRD FR-MATCH-01.2 calls for portfolio photos but no upload path
// existed until now (see the migration note). Owner only, multipart,
// field name "photos" (repeatable).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id, portfolio_photos")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile)
    return fail("FORBIDDEN", "Braider profile not found or not owned by you.", 403);

  const formData = await request.formData();
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File);

  if (files.length === 0)
    return fail("VALIDATION_ERROR", "At least one photo is required.", 422, "photos");
  if (braiderProfile.portfolio_photos.length + files.length > MAX_PORTFOLIO_PHOTOS) {
    return fail(
      "VALIDATION_ERROR",
      `A portfolio can have at most ${MAX_PORTFOLIO_PHOTOS} photos.`,
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

  const admin = createAdminClient();
  const uploadedPaths: string[] = [];
  for (const [index, file] of files.entries()) {
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${Date.now()}-${index}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from("portfolio-photos")
      .upload(path, await file.arrayBuffer(), { contentType: file.type });
    if (uploadError)
      return fail("INTERNAL_ERROR", `Failed to upload photo: ${uploadError.message}`, 500);
    uploadedPaths.push(path);
  }

  const updatedPhotos = [...braiderProfile.portfolio_photos, ...uploadedPaths];
  const { error } = await supabase
    .from("braider_profiles")
    .update({ portfolio_photos: updatedPhotos })
    .eq("id", params.id);
  if (error) return fail("INTERNAL_ERROR", "Failed to record uploaded photos.", 500);

  return ok({ portfolio_photos: updatedPhotos }, 201);
}
