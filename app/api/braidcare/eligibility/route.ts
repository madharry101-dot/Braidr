import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkBraidcareEligibility } from "@/lib/braidcare/eligibility";
import { ok, fail } from "@/lib/api/response";

// GET /api/braidcare/eligibility?booking_id=... — TRD v2.0 §4.2.
// Returns whether the caller can start a BraidCare session (optionally
// against a specific booking), per the two-path logic in eligibility.ts.
// Not an error when ineligible — the shape carries the reason.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const bookingId = new URL(request.url).searchParams.get("booking_id");
  const result = await checkBraidcareEligibility(supabase, user.id, bookingId);

  if (result.ok) {
    return ok({
      eligible: true,
      reason: result.reason,
      sessions_used: result.booking?.sessions_used ?? null,
      sessions_allocated: result.booking?.sessions_allocated ?? null,
    });
  }
  return ok({ eligible: false, reason: result.code, message: result.message });
}
