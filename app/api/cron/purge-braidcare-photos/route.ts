import { createAdminClient } from "@/lib/supabase/admin";
import { runPurgeBraidcarePhotos } from "@/lib/cron/purge-braidcare-photos";
import { ok, fail } from "@/lib/api/response";

// GET /api/cron/purge-braidcare-photos — GDPR-04 / Privacy §7. Deletes
// scalp-photo storage objects (and clears the row's photo_paths) 90 days
// after upload; the text report stays. Triggered daily by
// netlify/functions/cron-purge-braidcare-photos.mjs; runnable by hand with
// the CRON_SECRET bearer token.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return fail("UNAUTHENTICATED", "Not authorized.", 401);
  }

  try {
    const result = await runPurgeBraidcarePhotos(createAdminClient());
    return ok(result);
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed to purge photos.", 500);
  }
}
