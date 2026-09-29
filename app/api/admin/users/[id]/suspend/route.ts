import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { suspendUserSchema } from "@/lib/validations/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { ok, fail } from "@/lib/api/response";

// PUT /api/admin/users/:id/suspend — TRD 4.8 / PRD FR-ADMIN-01.1.
// Reversible (pass suspended: false to lift it) — see middleware.ts and
// /api/auth/login for where this is actually enforced.
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  // R-09 — the `admin` limiter group existed in config but was never called,
  // so reading it suggested these routes were capped at 100/min when nothing
  // enforced it. Wired now. Fails open: these are already role-gated, so this
  // is defence in depth, not the control.
  const limited = rateLimitResponse(await checkRateLimit("admin", user.id));
  if (limited) return limited;

  const parsed = validate(suspendUserSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  if (params.id === user.id && parsed.data.suspended) {
    return fail("VALIDATION_ERROR", "You can't suspend your own account.", 422);
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("profiles")
    .update({ is_suspended: parsed.data.suspended })
    .eq("id", params.id)
    .select("id")
    .single();

  if (error || !updated) return fail("NOT_FOUND", "User not found.", 404);
  return ok({ suspended: parsed.data.suspended });
}
