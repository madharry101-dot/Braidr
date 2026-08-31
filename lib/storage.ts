// The `avatars`, `portfolio-photos` and `blog-images` buckets are public
// (see 20260826000013_storage_buckets.sql and 20260909000001_blog.sql), so
// their objects have stable public URLs — no signed-URL round trip needed.
//
// `scalp-photos` is deliberately NOT in this union: it is private,
// owner-scoped and purged after 90 days, and must only ever be reached
// through a short-lived signed URL.

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Every upload route namespaces its storage path by the owner's user id, and
 * every one of them writes through the service-role client — which bypasses
 * storage RLS. The bucket policies say the first path segment must equal
 * `auth.uid()`, but that check never runs for a service-role write, so the
 * path convention is enforced here in code or it is not enforced at all.
 *
 * `if (!user)` is not sufficient on its own: it proves a session exists, not
 * that the id is well-formed. Two objects were found in `scalp-photos` under
 * `braidcare/undefined/...` (uploaded 2026-08-27, since deleted), which is
 * what the missing check looks like once it reaches production — an object
 * outside every owner's namespace, unreachable by the RLS policy that is
 * supposed to govern it, and invisible to any per-user cleanup.
 *
 * A UUID shape test rather than a truthiness test, so it also rejects an
 * empty string and anything carrying a `/` that could climb out of the
 * intended folder.
 */
export function isValidStorageOwnerId(id: string | null | undefined): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id); // prettier-ignore
}

export function publicStorageUrl(
  bucket: "avatars" | "portfolio-photos" | "blog-images",
  path: string
): string {
  // avatar_url may already be a full URL (no dedicated upload endpoint sets
  // a consistent format) — pass those through untouched.
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE}/storage/v1/object/public/${bucket}/${path.replace(/^\/+/, "")}`;
}
