import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { ok, fail } from "@/lib/api/response";
import { checkRateLimit, clientIp } from "@/lib/api/rate-limit";

// POST /api/auth/reset-password — TRD 4.2 / v2.0 §4.1.
// FR-AUTH-01.5: reset link expiry of 1 hour is a Supabase Auth project
// setting. FR-AUTH-02.6: a Google-only account can't use a password reset —
// tell the caller to use "Continue with Google" instead.
export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit("auth", clientIp(request));
  if (!rateLimit.success) {
    return fail("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  const parsed = validate(resetPasswordSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { email } = parsed.data;

  const admin = createAdminClient();
  const { data: googleOnly } = await admin.rpc("email_is_google_only", { p_email: email });
  if (googleOnly) {
    return ok({ sent: false, google_only: true });
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
  });

  // Always report success (unless Google-only, which is a genuine help, not
  // an enumeration risk) so this endpoint can't probe for registered
  // password accounts.
  return ok({ sent: true, google_only: false });
}
