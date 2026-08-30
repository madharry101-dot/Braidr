// The `avatars`, `portfolio-photos` and `blog-images` buckets are public
// (see 20260826000013_storage_buckets.sql and 20260909000001_blog.sql), so
// their objects have stable public URLs — no signed-URL round trip needed.
//
// `scalp-photos` is deliberately NOT in this union: it is private,
// owner-scoped and purged after 90 days, and must only ever be reached
// through a short-lived signed URL.

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function publicStorageUrl(
  bucket: "avatars" | "portfolio-photos" | "blog-images",
  path: string
): string {
  // avatar_url may already be a full URL (no dedicated upload endpoint sets
  // a consistent format) — pass those through untouched.
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE}/storage/v1/object/public/${bucket}/${path.replace(/^\/+/, "")}`;
}
