import { createClient } from "@/lib/supabase/server";
import { decryptUtr, maskUtr } from "@/lib/crypto/utr";
import { ok, fail } from "@/lib/api/response";

// GET /api/pro/progress — TRD 4.6, braider only.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile) return fail("ROLE_MISMATCH", "Only braiders have a Pro pathway.", 403);

  const { data: progress } = await supabase
    .from("braidr_pro_progress")
    .select(
      "assessment_completed, assessment_results, step2_hmrc_completed, step2_utr, step3_insurance_completed, step4_banking_completed, step4_badge_awarded, step5_accessed, overall_progress_pct"
    )
    .eq("braider_id", braiderProfile.id)
    .single();

  if (!progress) {
    // No row yet is the normal "hasn't started" state, not an error — the
    // row is only created when the assessment (Step 1) is first submitted.
    return ok({ progress: null, started: false });
  }

  // PRD/TRD: UTR is "masked in display" — never return the plaintext, and
  // don't even keep the ciphertext in the response body.
  const { step2_utr, ...rest } = progress;
  const utr_masked = step2_utr ? maskUtr(decryptUtr(step2_utr)) : null;

  return ok({ progress: { ...rest, utr_masked }, started: true });
}
