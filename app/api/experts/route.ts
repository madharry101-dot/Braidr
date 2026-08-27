import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/response";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_DOC_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

// GET /api/experts — TRD 4.7 / PRD FR-EXP-01.1. Public directory: verified
// + active only.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const specialisation = request.nextUrl.searchParams.get("specialisation");

  let query = supabase
    .from("expert_profiles")
    .select(
      "id, credentials, specialisation, clinic_name, city, consultation_fee_pence, booking_url"
    )
    .eq("is_verified", true)
    .eq("is_active", true);

  if (specialisation) query = query.contains("specialisation", [specialisation]);

  const { data: experts, error } = await query;
  if (error) return fail("INTERNAL_ERROR", "Failed to load experts.", 500);
  return ok({ experts: experts ?? [] });
}

// POST /api/experts — not in the TRD's endpoint table (which only lists
// the read/referral side of Expert Network), but PRD FR-EXP-01.6 requires
// "credential upload, admin review, profile publication workflow" — this
// is where that pathway starts. is_verified defaults false; the profile
// isn't publicly listed (GET above requires is_verified=true) until an
// admin approves it via PUT /api/admin/experts/:id/verify.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "expert") {
    return fail("ROLE_MISMATCH", "Only expert-role accounts can create an expert profile.", 403);
  }

  const { data: existing } = await supabase
    .from("expert_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (existing) return fail("VALIDATION_ERROR", "You already have an expert profile.", 409);

  const formData = await request.formData();
  const credentials = formData.get("credentials");
  const city = formData.get("city");
  const clinicName = formData.get("clinic_name");
  const specialisationRaw = formData.get("specialisation"); // comma-separated
  const consultationFee = formData.get("consultation_fee_pence");
  const bookingUrl = formData.get("booking_url");
  const document = formData.get("credential_document");

  if (typeof credentials !== "string" || !credentials.trim()) {
    return fail("VALIDATION_ERROR", "credentials is required.", 422, "credentials");
  }
  if (typeof city !== "string" || !city.trim()) {
    return fail("VALIDATION_ERROR", "city is required.", 422, "city");
  }
  if (!(document instanceof File)) {
    return fail(
      "VALIDATION_ERROR",
      "A credential document is required.",
      422,
      "credential_document"
    );
  }
  if (!ALLOWED_DOC_TYPES.has(document.type)) {
    return fail(
      "VALIDATION_ERROR",
      "Document must be a PDF, JPEG, or PNG.",
      422,
      "credential_document"
    );
  }
  if (document.size > MAX_UPLOAD_BYTES) {
    return fail("VALIDATION_ERROR", "Document must be 5MB or smaller.", 422, "credential_document");
  }

  const admin = createAdminClient();
  const ext =
    document.type === "application/pdf" ? "pdf" : document.type === "image/png" ? "png" : "jpg";
  const path = `${user.id}/${Date.now()}-credentials.${ext}`;
  const { error: uploadError } = await admin.storage
    .from("expert-credentials")
    .upload(path, await document.arrayBuffer(), { contentType: document.type });
  if (uploadError)
    return fail("INTERNAL_ERROR", `Failed to upload document: ${uploadError.message}`, 500);

  const { data: expertProfile, error } = await supabase
    .from("expert_profiles")
    .insert({
      user_id: user.id,
      credentials: credentials.trim(),
      city: city.trim(),
      clinic_name: typeof clinicName === "string" && clinicName ? clinicName : undefined,
      specialisation:
        typeof specialisationRaw === "string" && specialisationRaw
          ? specialisationRaw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      consultation_fee_pence:
        typeof consultationFee === "string" && consultationFee
          ? Number(consultationFee)
          : undefined,
      booking_url: typeof bookingUrl === "string" && bookingUrl ? bookingUrl : undefined,
      credential_doc_path: path,
    })
    .select("id")
    .single();

  if (error || !expertProfile)
    return fail("INTERNAL_ERROR", "Failed to create expert profile.", 500);
  return ok({ expert_id: expertProfile.id, status: "pending_review" }, 201);
}
