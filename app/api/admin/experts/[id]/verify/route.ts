import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { verifyExpertSchema } from "@/lib/validations/expert";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// PUT /api/admin/experts/:id/verify — TRD 4.8 / PRD FR-ADMIN-01.3
// "approve or reject [credentials]". Rejecting doesn't delete the
// profile — it just leaves is_verified false (so it stays unlisted) with
// a note the expert can see via GET /api/experts/:id, and is_active set
// false so a rejected applicant doesn't linger as if still under review.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const parsed = validate(verifyExpertSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("expert_profiles")
    .update({
      is_verified: parsed.data.approve,
      is_active: parsed.data.approve ? true : false,
      verification_note: parsed.data.note ?? null,
    })
    .eq("id", params.id)
    .select("id")
    .single();

  if (error || !updated) return fail("NOT_FOUND", "Expert profile not found.", 404);
  return ok({ approved: parsed.data.approve });
}
