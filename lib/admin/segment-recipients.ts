import type { createAdminClient } from "@/lib/supabase/admin";
import type { AnnouncementInput } from "@/lib/validations/moderation";

/**
 * Resolves a segment filter to {id, email} pairs. Two-step rather than N
 * individual admin.auth.admin.getUserById calls per matched profile: fetch
 * matching profile ids from the DB, then fetch auth users in bulk pages and
 * join in memory. Capped at 10 pages (2000 users at 200/page) — realistic
 * for Braidr's projected scale (peak ~364 braiders by Year 3 per the
 * financial model); a platform with genuinely more users than that would
 * need this moved to a queued/paginated send rather than one request, same
 * constraint already flagged for BraidCare's AI retry design.
 */
export async function resolveSegmentRecipients(
  admin: ReturnType<typeof createAdminClient>,
  segment: AnnouncementInput["segment"]
): Promise<Array<{ id: string; email: string }>> {
  let query = admin.from("profiles").select("id");
  if (segment.role) query = query.eq("role", segment.role);
  if (segment.city) query = query.eq("city", segment.city);
  if (segment.braidcare_client_subscribed !== undefined) {
    query = query.eq("braidcare_client_subscribed", segment.braidcare_client_subscribed);
  }

  const { data: matchedProfiles, error } = await query;
  if (error) throw new Error(`Failed to resolve segment: ${error.message}`);

  let profileIds = new Set((matchedProfiles ?? []).map((p) => p.id));

  if (segment.braidr_pro_subscribed !== undefined) {
    const { data: braiderProfiles, error: bpError } = await admin
      .from("braider_profiles")
      .select("user_id")
      .eq("braidr_pro_subscribed", segment.braidr_pro_subscribed);
    if (bpError) throw new Error(`Failed to resolve segment: ${bpError.message}`);
    const proUserIds = new Set((braiderProfiles ?? []).map((b) => b.user_id));
    profileIds = new Set([...profileIds].filter((id) => proUserIds.has(id)));
  }

  if (profileIds.size === 0) return [];

  const emailById = new Map<string, string>();
  const MAX_PAGES = 10;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listError) throw new Error(`Failed to list users: ${listError.message}`);
    for (const u of data.users) {
      if (profileIds.has(u.id) && u.email) emailById.set(u.id, u.email);
    }
    if (data.users.length < 200) break; // last page
  }

  return [...profileIds]
    .filter((id) => emailById.has(id))
    .map((id) => ({ id, email: emailById.get(id)! }));
}
