import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { ok, fail } from "@/lib/api/response";

// GET /api/admin/experts/:id/credential-url — a short-lived signed URL for
// the uploaded credential document, so an admin can actually review it
// before approving. Admin-only; the expert-credentials bucket is private
// and the column is revoked from `authenticated`, so this is the only read
// path (TRD 3.1.6: "admin access only").
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
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

  const admin = createAdminClient();
  const { data: expert } = await admin
    .from("expert_profiles")
    .select("credential_doc_path")
    .eq("id", params.id)
    .single();

  if (!expert?.credential_doc_path) {
    return fail("NOT_FOUND", "No credential document on file.", 404);
  }

  const { data, error } = await admin.storage
    .from("expert-credentials")
    .createSignedUrl(expert.credential_doc_path, 300);
  if (error || !data) return fail("INTERNAL_ERROR", "Couldn't generate a link.", 500);

  return ok({ url: data.signedUrl });
}
