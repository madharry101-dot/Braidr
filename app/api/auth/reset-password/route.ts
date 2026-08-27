import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { ok, fail } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/api/rate-limit";

// POST /api/auth/reset-password — TRD 4.2. FR-AUTH-01.5: reset link expiry
// of 1 hour is a Supabase Auth project setting, not app code.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimit = await checkRateLimit("auth", ip);
  if (!rateLimit.success) {
    return fail("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  const parsed = validate(resetPasswordSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password/confirm`,
  });

  // Always return success regardless of whether the email exists, so this
  // endpoint can't be used to enumerate registered accounts.
  return ok({ sent: true });
}
