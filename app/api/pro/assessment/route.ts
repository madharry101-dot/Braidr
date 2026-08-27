import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { assessmentSchema } from "@/lib/validations/pro";
import { buildRoadmap } from "@/lib/pro/roadmap";
import { ok, fail } from "@/lib/api/response";

// POST /api/pro/assessment — TRD 4.6 / PRD FR-PRO-01.5-01.6. Step 1.
// Re-submittable (a braider's circumstances change), which is why this is
// an upsert on braider_id rather than a one-time insert.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(assessmentSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile) return fail("ROLE_MISMATCH", "Only braiders have a Pro pathway.", 403);

  const { data: progress, error } = await supabase
    .from("braidr_pro_progress")
    .upsert(
      {
        braider_id: braiderProfile.id,
        assessment_completed: true,
        assessment_results: parsed.data,
      },
      { onConflict: "braider_id" }
    )
    .select(
      "step2_hmrc_completed, step3_insurance_completed, step4_banking_completed, step5_accessed"
    )
    .single();

  if (error || !progress) return fail("INTERNAL_ERROR", "Failed to save assessment.", 500);

  const roadmap = buildRoadmap(parsed.data, progress);
  return ok({ roadmap });
}
