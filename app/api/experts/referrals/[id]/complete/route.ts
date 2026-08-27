import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { completeReferralSchema } from "@/lib/validations/expert";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// PUT /api/experts/referrals/:id/complete — not in the TRD's endpoint
// table as a distinct route, but PRD FR-EXP-01.5 ("admin dashboard records
// completed referrals and triggers fee payment") needs one. Admin-only —
// see the expert_referrals migration note on why this isn't self-reported
// by either party.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const parsed = validate(completeReferralSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("expert_referrals")
    .update({
      status: "completed",
      referral_fee_pence: parsed.data.referral_fee_pence,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .select("id")
    .single();

  if (error || !updated) return fail("NOT_FOUND", "Referral not found.", 404);
  return ok({ completed: true });
}
