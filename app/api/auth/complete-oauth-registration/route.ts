import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { completeOAuthRegistrationSchema } from "@/lib/validations/auth";
import { clientIp } from "@/lib/api/rate-limit";
import { recordConsent } from "@/lib/consent/record";
import { TERMS_AND_PRIVACY_VERSION, MARKETING_VERSION } from "@/lib/consent/versions";
import { ok, fail } from "@/lib/api/response";

// POST /api/auth/complete-oauth-registration — TRD v2.0 §4.1 / §6.1.
// Finishes a Google sign-up: the user already has an auth.users row and a
// session, but no profiles row (handle_new_user skips OAuth users). Captures
// their role choice and Terms/Privacy consent (GDPR-09 — Google's own
// consent screen does not satisfy this), then creates the profile.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  // Idempotency + anti-abuse: never let this endpoint overwrite an existing
  // profile (e.g. change role after the fact).
  const { data: existing } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (existing) return ok({ role: existing.role, already_registered: true });

  const parsed = validate(completeOAuthRegistrationSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { role, marketing_opt_in, referred_by } = parsed.data;

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    "";

  const admin = createAdminClient();

  // Attribute the referral only if the code actually exists (FR-REF-01.4).
  let referredBy: string | null = null;
  if (referred_by) {
    const { data: referrer } = await admin
      .from("profiles")
      .select("id")
      .eq("referral_code", referred_by.toUpperCase())
      .maybeSingle();
    if (referrer && referrer.id !== user.id) referredBy = referred_by.toUpperCase();
  }

  const { error: insertError } = await admin
    .from("profiles")
    .insert({ id: user.id, role, full_name: fullName, referred_by: referredBy });
  if (insertError) {
    console.error("[complete-oauth] profile insert failed", insertError);
    return fail("INTERNAL_ERROR", "Could not finish setting up your account.", 500);
  }

  await recordConsent(admin, user.id, clientIp(request), [
    {
      consent_type: "terms_and_privacy",
      consent_version: TERMS_AND_PRIVACY_VERSION,
      granted: true,
    },
    { consent_type: "marketing", consent_version: MARKETING_VERSION, granted: marketing_opt_in },
  ]);

  return ok({ role }, 201);
}
