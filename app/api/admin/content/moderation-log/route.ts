import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { ok, fail } from "@/lib/api/response";

// GET /api/admin/content/moderation-log — audit trail for FR-ADMIN-01.6.
export async function GET() {
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

  const admin = createAdminClient();
  const { data: log, error } = await admin
    .from("content_moderation_log")
    .select("id, admin_id, target_type, target_user_id, removed_path, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail("INTERNAL_ERROR", "Failed to load moderation log.", 500);
  return ok({ log: log ?? [] });
}
