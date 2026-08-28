import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { registerSchema } from "@/lib/validations/auth";
import { ok, fail } from "@/lib/api/response";
import { checkRateLimit, clientIp } from "@/lib/api/rate-limit";
import { recordConsent } from "@/lib/consent/record";
import { TERMS_AND_PRIVACY_VERSION, MARKETING_VERSION } from "@/lib/consent/versions";

// POST /api/auth/register — TRD 4.2. No auth required.
// GDPR-01 / GDPR-02: Terms/Privacy consent (required) and marketing opt-in
// (optional) are captured here, in the registration handler, per the
// Consent Library technical notes.
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const rateLimit = await checkRateLimit("auth", ip);
  if (!rateLimit.success) {
    return fail("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  const parsed = validate(registerSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { email, password, full_name, role, marketing_opt_in } = parsed.data;

  const supabase = await createClient();

  // role/full_name flow into raw_user_meta_data, read by the
  // handle_new_user() trigger to populate public.profiles (FR-AUTH-01.4).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role, full_name } },
  });

  if (error) {
    return fail("VALIDATION_ERROR", error.message, 422, "email");
  }

  // Record consent against the new user id. Uses the service-role client
  // because email confirmation may be pending, so there's no session yet.
  if (data.user?.id) {
    await recordConsent(createAdminClient(), data.user.id, ip, [
      {
        consent_type: "terms_and_privacy",
        consent_version: TERMS_AND_PRIVACY_VERSION,
        granted: true,
      },
      { consent_type: "marketing", consent_version: MARKETING_VERSION, granted: marketing_opt_in },
    ]);
  }

  return ok({ user_id: data.user?.id, email_confirmation_required: !data.session }, 201);
}
