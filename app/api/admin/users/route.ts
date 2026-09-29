import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { listUsersSchema } from "@/lib/validations/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { ok, fail } from "@/lib/api/response";

// GET /api/admin/users — TRD 4.8 / PRD FR-ADMIN-01.1.
export async function GET(request: NextRequest) {
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

  const parsed = validate(listUsersSchema, Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.ok) return parsed.response;
  const { role, search, limit } = parsed.data;

  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select("id, role, full_name, display_name, city, is_suspended, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (role) query = query.eq("role", role);
  if (search) query = query.ilike("full_name", `%${search}%`);

  const { data: users, error } = await query;
  if (error) return fail("INTERNAL_ERROR", "Failed to load users.", 500);
  return ok({ users });
}
