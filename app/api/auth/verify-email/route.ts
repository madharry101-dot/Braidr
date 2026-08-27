import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { verifyEmailSchema } from "@/lib/validations/verify-email";
import { ok, fail } from "@/lib/api/response";

// POST /api/auth/verify-email — TRD 4.2. Called by the client-side
// confirmation page with the token_hash/type from the emailed link
// (FR-AUTH-01.3: email verification required before full account access).
export async function POST(request: NextRequest) {
  const parsed = validate(verifyEmailSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp(parsed.data);

  if (error) {
    return fail("VALIDATION_ERROR", "This verification link is invalid or has expired.", 422);
  }

  return ok({ verified: true });
}
