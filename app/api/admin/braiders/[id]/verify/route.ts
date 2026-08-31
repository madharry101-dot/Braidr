import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { verifyBraiderSchema } from "@/lib/validations/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// PUT /api/admin/braiders/:id/verify — TRD 4.8 / PRD FR-ADMIN-01.2.
// Does not touch is_active — see the migration note on why a rejected
// braider stays live but unverified rather than being unpublished.
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const parsed = validate(verifyBraiderSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("braider_profiles")
    .update({ is_verified: parsed.data.approve, verification_note: parsed.data.note ?? null })
    .eq("id", params.id)
    .select("id")
    .single();

  if (error || !updated) return fail("NOT_FOUND", "Braider profile not found.", 404);
  return ok({ approved: parsed.data.approve });
}
