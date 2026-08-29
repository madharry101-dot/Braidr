import type { createAdminClient } from "@/lib/supabase/admin";

// GDPR-04 + Privacy Policy §7 — scalp photographs are deleted 90 days after
// upload. The text report is kept (Privacy §7: "retained as part of your
// account history until account deletion"). Anchored on the session's
// created_at: photos are uploaded within the session flow, so 90 days from
// session creation is a safe lower bound on "90 days from upload".
const RETENTION_DAYS = 90;

export async function runPurgeBraidcarePhotos(admin: ReturnType<typeof createAdminClient>) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: stale, error } = await admin
    .from("braidcare_sessions")
    .select("id, photo_paths")
    .lt("created_at", cutoff)
    .gt("photos_count", 0);

  if (error) throw new Error(`purge query failed: ${error.message}`);

  let sessionsPurged = 0;
  let photosRemoved = 0;

  for (const session of stale ?? []) {
    const paths = session.photo_paths ?? [];
    if (paths.length === 0) continue;

    const { error: rmError } = await admin.storage.from("scalp-photos").remove(paths);
    if (rmError) {
      console.error(`[purge-photos] storage remove failed for session ${session.id}`, rmError);
      continue; // leave the row untouched so the next run retries
    }

    const { error: updError } = await admin
      .from("braidcare_sessions")
      .update({ photo_paths: [], photos_count: 0 })
      .eq("id", session.id);
    if (updError) {
      console.error(`[purge-photos] row update failed for session ${session.id}`, updError);
      continue;
    }

    sessionsPurged += 1;
    photosRemoved += paths.length;
  }

  return {
    retention_days: RETENTION_DAYS,
    sessions_purged: sessionsPurged,
    photos_removed: photosRemoved,
  };
}
