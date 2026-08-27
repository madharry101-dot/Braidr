import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

// GET /api/experts/me — the signed-in expert's own profile (verified or
// not), or null if they haven't created one. Not in the TRD endpoint table
// but the expert dashboard has no other way to find its own profile id:
// GET /api/experts is verified-only and GET /api/experts/:id needs an id.
// Same rationale as /api/braiders/me.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: expert } = await supabase
    .from("expert_profiles")
    .select(
      "id, user_id, credentials, specialisation, clinic_name, city, consultation_fee_pence, booking_url, is_verified, is_active, verification_note"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  return ok({ expert: expert ?? null });
}
