import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicStorageUrl } from "@/lib/storage";
import { ok, fail } from "@/lib/api/response";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// POST /api/blog/images — upload one image for use in a post body.
// Admins and dermatologist advisors only. Multipart, field name "image".
// Returns the public URL, which the editor inserts as Markdown.
//
// Lands in the public `blog-images` bucket — deliberately never
// `scalp-photos`, which is private, owner-scoped and 90-day purged.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "expert") {
    return fail("FORBIDDEN", "Only admins and advisors can upload blog images.", 403);
  }

  const formData = await request.formData();
  const file = formData.get("image");
  if (!(file instanceof File)) {
    return fail("VALIDATION_ERROR", "An image file is required.", 422, "image");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return fail("VALIDATION_ERROR", "Images must be JPEG, PNG, WEBP or GIF.", 422, "image");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail("VALIDATION_ERROR", "Images must be 5MB or smaller.", 422, "image");
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const path = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("blog-images")
    .upload(path, await file.arrayBuffer(), { contentType: file.type });
  if (error) {
    console.error("[blog/images] upload failed", error);
    return fail("INTERNAL_ERROR", `Couldn't upload the image: ${error.message}`, 500);
  }

  return ok({ path, url: publicStorageUrl("blog-images", path) }, 201);
}
