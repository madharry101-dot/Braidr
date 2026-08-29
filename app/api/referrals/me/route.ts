import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

// GET /api/referrals/me — TRD v2.0 §4.3. The current user's referral code,
// its full link, and a static "rewards coming soon" flag (Phase 1 has no
// reward logic — PRD v2.0 FR-REF-01.6).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", user.id)
    .single();
  if (!profile) return fail("NOT_FOUND", "Profile not found.", 404);

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://braidr.netlify.app";
  return ok({
    code: profile.referral_code,
    link: `${base}/r/${profile.referral_code}`,
    rewards: "coming_soon" as const,
  });
}
