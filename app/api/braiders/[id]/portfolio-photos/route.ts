import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/response";
import { isHairTexture, type HairTexture } from "@/lib/hair/textures";
import { sanitiseUploadedImage } from "@/lib/images/sanitise";
import { isValidStorageOwnerId } from "@/lib/storage";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PORTFOLIO_PHOTOS = 12;

// POST /api/braiders/:id/portfolio-photos — owner only, multipart, field
// name "photos" (repeatable). Optional "texture" field applies one texture
// tag to every photo in this batch (Part 1 — texture-verified
// specialisations). Rows land in braider_portfolio_photos.
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  // Service-role write below bypasses storage RLS — see isValidStorageOwnerId.
  if (!isValidStorageOwnerId(user.id)) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile)
    return fail("FORBIDDEN", "Braider profile not found or not owned by you.", 403);

  const { count: existingCount } = await supabase
    .from("braider_portfolio_photos")
    .select("id", { count: "exact", head: true })
    .eq("braider_id", params.id);

  const formData = await request.formData();
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File);
  const textureRaw = formData.get("texture");
  const texture = typeof textureRaw === "string" && isHairTexture(textureRaw) ? textureRaw : null;

  if (files.length === 0)
    return fail("VALIDATION_ERROR", "At least one photo is required.", 422, "photos");
  if ((existingCount ?? 0) + files.length > MAX_PORTFOLIO_PHOTOS) {
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

  // R-02: re-encode before storage. This bucket is PUBLIC — objects sit at
  // stable unauthenticated URLs — and braiders photograph their work where
  // they do it, which for most of them is home. Storing the originals
  // published the EXIF GPS of a braider's front door to anyone who opened
  // the image. Sanitising also proves the bytes decode as an image, so the
  // client's declared MIME type is no longer trusted (R-05).
  //
  // All files are sanitised up front so a bad one at index 3 cannot abort
  // the request after 0-2 were already written to a public bucket.
  const sanitised = [];
  for (const file of files) {
    const image = await sanitiseUploadedImage(await file.arrayBuffer());
    if (!image) {
      return fail(
        "VALIDATION_ERROR",
        "Each photo must be a valid JPEG, PNG, or WEBP image.",
        422,
        "photos"
      );
    }
    sanitised.push(image);
  }

  const admin = createAdminClient();
  const rows: {
    braider_id: string;
    storage_path: string;
    texture: HairTexture | null;
    sort_order: number;
  }[] = [];
  for (const [index, image] of sanitised.entries()) {
    const path = `${user.id}/${Date.now()}-${index}.${image.ext}`;
    const { error: uploadError } = await admin.storage
      .from("portfolio-photos")
      .upload(path, image.buffer, { contentType: image.contentType });
    if (uploadError)
      return fail("INTERNAL_ERROR", `Failed to upload photo: ${uploadError.message}`, 500);
    rows.push({
      braider_id: params.id,
      storage_path: path,
      texture,
      sort_order: (existingCount ?? 0) + index,
    });
  }

  const { error } = await supabase.from("braider_portfolio_photos").insert(rows);
  if (error) return fail("INTERNAL_ERROR", "Failed to record uploaded photos.", 500);

  return ok({ added: rows.length }, 201);
}
