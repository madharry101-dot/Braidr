import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { step2Schema } from "@/lib/validations/pro";
import { encryptUtr } from "@/lib/crypto/utr";
import { ok, fail } from "@/lib/api/response";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_DOC_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

// PUT /api/pro/steps/:step — TRD 4.6 / PRD FR-PRO-01.4: "Each step unlocks
// only after the previous step is marked complete" — enforced below by
// checking the prior step's completion flag before allowing this one.
// Step 1 (the assessment) has its own endpoint (POST /api/pro/assessment);
// this route only ever receives 2-5.
export async function PUT(request: NextRequest, props: { params: Promise<{ step: string }> }) {
  const params = await props.params;
  const step = Number(params.step);
  if (![2, 3, 4, 5].includes(step)) {
    return fail("VALIDATION_ERROR", "step must be 2, 3, 4, or 5.", 422);
  }

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
      "assessment_completed, step2_hmrc_completed, step3_insurance_completed, step4_banking_completed, step5_accessed"
    )
    .eq("braider_id", braiderProfile.id)
    .single();
  if (!progress) {
    return fail("VALIDATION_ERROR", "Complete the readiness assessment (Step 1) first.", 422);
  }

  const PREREQUISITE_MET: Record<number, boolean> = {
    2: progress.assessment_completed,
    3: progress.step2_hmrc_completed,
    4: progress.step3_insurance_completed,
    5: progress.step4_banking_completed,
  };
  if (!PREREQUISITE_MET[step]) {
    return fail("VALIDATION_ERROR", `Complete step ${step - 1} before starting step ${step}.`, 422);
  }

  if (step === 2) return completeStep2(request, supabase, braiderProfile.id);
  if (step === 3) return completeStep3(request, supabase, user.id, braiderProfile.id);
  if (step === 4) return completeStep4(braiderProfile.id);
  return completeStep5(supabase, braiderProfile.id);
}

async function completeStep2(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof createClient>>,
  braiderId: string
) {
  const parsed = validate(step2Schema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { error } = await supabase
    .from("braidr_pro_progress")
    .update({ step2_utr: encryptUtr(parsed.data.utr), step2_hmrc_completed: true })
    .eq("braider_id", braiderId);
  if (error) return fail("INTERNAL_ERROR", "Failed to save HMRC registration.", 500);
  return ok({ step: 2, completed: true });
}

async function completeStep3(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  braiderId: string
) {
  const formData = await request.formData();
  const file = formData.get("document");
  if (!(file instanceof File))
    return fail("VALIDATION_ERROR", "A document file is required.", 422, "document");
  if (!ALLOWED_DOC_TYPES.has(file.type)) {
    return fail("VALIDATION_ERROR", "Document must be a PDF, JPEG, or PNG.", 422, "document");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail("VALIDATION_ERROR", "Document must be 5MB or smaller.", 422, "document");
  }

  const admin = createAdminClient();
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${userId}/${Date.now()}-proof-of-insurance.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("insurance-documents")
    .upload(path, await file.arrayBuffer(), { contentType: file.type });
  if (uploadError)
    return fail("INTERNAL_ERROR", `Failed to upload document: ${uploadError.message}`, 500);

  const { error } = await supabase
    .from("braidr_pro_progress")
    .update({ step3_insurance_doc_path: path, step3_insurance_completed: true })
    .eq("braider_id", braiderId);
  if (error) return fail("INTERNAL_ERROR", "Failed to save insurance step.", 500);
  return ok({ step: 3, completed: true });
}

async function completeStep4(braiderId: string) {
  // The verified badge is awarded here — via the admin client, since
  // step4_badge_awarded is guarded (service-role only) precisely so a
  // braider can't self-award it (see the braidr_pro_progress migration).
  // This route is the one legitimate place that flips it, immediately
  // after the platform's own prerequisite chain confirms steps 1-3 are done.
  const admin = createAdminClient();
  const { error } = await admin
    .from("braidr_pro_progress")
    .update({ step4_banking_completed: true, step4_badge_awarded: true })
    .eq("braider_id", braiderId);
  if (error) return fail("INTERNAL_ERROR", "Failed to save business identity step.", 500);
  return ok({ step: 4, completed: true, badge_awarded: true });
}

async function completeStep5(
  supabase: Awaited<ReturnType<typeof createClient>>,
  braiderId: string
) {
  const { error } = await supabase
    .from("braidr_pro_progress")
    .update({ step5_accessed: true })
    .eq("braider_id", braiderId);
  if (error) return fail("INTERNAL_ERROR", "Failed to save growth & CPD step.", 500);
  return ok({ step: 5, completed: true });
}
