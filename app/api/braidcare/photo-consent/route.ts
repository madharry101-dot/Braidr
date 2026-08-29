import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

// GET /api/braidcare/photo-consent — GDPR-04 / GDPR-05. Has the caller
// given (and not since withdrawn) consent for scalp-photo processing?
// The BraidCare session flow shows the consent screen before the first
// upload whenever this is false.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: latest } = await supabase
    .from("consent_events")
    .select("granted, created_at")
    .eq("user_id", user.id)
    .eq("consent_type", "braidcare_photo_processing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ok({ consented: latest?.granted === true, since: latest?.created_at ?? null });
}
