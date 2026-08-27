// The `avatars` and `portfolio-photos` buckets are public (see
// supabase/migrations/20260826000013_storage_buckets.sql), so their objects
// have stable public URLs — no signed-URL round trip needed.

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function publicStorageUrl(bucket: "avatars" | "portfolio-photos", path: string): string {
  // avatar_url may already be a full URL (no dedicated upload endpoint sets
  // a consistent format) — pass those through untouched.
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE}/storage/v1/object/public/${bucket}/${path.replace(/^\/+/, "")}`;
}
