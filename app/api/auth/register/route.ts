import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { registerSchema } from "@/lib/validations/auth";
import { ok, fail } from "@/lib/api/response";
import { checkRateLimit, clientIp } from "@/lib/api/rate-limit";
import { recordConsent } from "@/lib/consent/record";
import { TERMS_AND_PRIVACY_VERSION, MARKETING_VERSION } from "@/lib/consent/versions";
import { isAlreadyRegistered, publicSignUpError } from "@/lib/auth/signup-errors";
import { randomUUID } from "crypto";

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
  const { email, password, full_name, role, marketing_opt_in, referred_by } = parsed.data;

  const supabase = await createClient();

  // role/full_name/referred_by flow into raw_user_meta_data, read by the
  // handle_new_user() trigger to populate public.profiles (FR-AUTH-01.4 /
  // FR-REF-01.4).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
        full_name,
        ...(referred_by ? { referred_by: referred_by.toUpperCase() } : {}),
      },
    },
  });

  if (error) {
    // R-08. Never echo Supabase's message: it is not ours to control, and in
    // a project with email confirmation disabled it says "User already
    // registered", which makes this endpoint an account-existence oracle.
    console.error("[register] signUp failed", { code: error.code, status: error.status });

    // An existing address is answered with the ORDINARY SUCCESS RESPONSE, so
    // a registered and an unregistered email are indistinguishable from the
    // outside. Supabase already does this itself while "Confirm email" is on
    // (measured: existing address -> no error, fake id, identities: []), so
    // this branch is unreachable in the current configuration. It exists so
    // the guarantee lives in code rather than in a dashboard toggle that can
    // be flipped without review. The id is random for exactly the same reason
    // Supabase's is: the shape must not betray which path was taken. The
    // register form does not read it when confirmation is pending.
    if (isAlreadyRegistered(error)) {
      return ok({ user_id: randomUUID(), email_confirmation_required: true }, 201);
    }

    const safe = publicSignUpError(error);
    return fail("VALIDATION_ERROR", safe.message, 422, safe.field);
  }

  // Record consent against the new user id. Uses the service-role client
  // because email confirmation may be pending, so there's no session yet.
  //
  // R-08 — DO NOT "OPTIMISE" THIS BY SKIPPING THE INSERT FOR A DUPLICATE
  // SIGNUP. While Supabase's own obfuscation is active, a signup for an
  // address that already exists arrives here with no error and a FAKE user
  // id, and this insert then fails its foreign key to profiles(id) and is
  // logged. That looks like waste, and it is tempting to detect the case
  // (the obfuscated user has `identities: []`) and return early. Doing so
  // would make the duplicate path measurably faster than the real one and
  // rebuild, in response time, exactly the oracle the response body no
  // longer leaks. The wasted round-trip is the point.
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
