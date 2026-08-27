import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// GET /api/admin/content/moderation-log — audit trail for FR-ADMIN-01.6.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const admin = createAdminClient();
  const { data: log, error } = await admin
    .from("content_moderation_log")
    .select("id, admin_id, target_type, target_user_id, removed_path, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail("INTERNAL_ERROR", "Failed to load moderation log.", 500);
  return ok({ log: log ?? [] });
}
