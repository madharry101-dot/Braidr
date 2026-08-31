import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAnalysis } from "@/lib/braidcare/run-analysis";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ok, fail } from "@/lib/api/response";

// POST /api/braidcare/sessions/:id/analyse — TRD 4.5 / 5.3 / 5.4.
//
// PLATFORM CONSTRAINT driving the design here: TRD 5.4 specifies retrying a
// timeout after 5s and backing off 429s over 5s/15s/45s within the same
// request — that's 65+ seconds of synchronous waiting, which exceeds
// Vercel's default serverless function timeout (10s on Hobby). So this
// route makes exactly ONE attempt per invocation. On failure it leaves the
// session 'in_progress' (credit NOT consumed, matching TRD 5.4's stated
// user impact) rather than blocking the request retrying — the actual
// retry loop lives in /api/cron/retry-braidcare-analysis, polling on the
// same schedule TRD 5.4 describes (every 15 minutes, up to 4 hours old).
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const rateLimit = await checkRateLimit("braidcareAnalyse", user.id);
  if (!rateLimit.success)
    return fail("RATE_LIMITED", "Too many analysis requests. Try again later.", 429);

  const { data: session } = await supabase
    .from("braidcare_sessions")
    .select("id, client_id, booking_id, status, photos_count")
    .eq("id", params.id)
    .single();
  if (!session || session.client_id !== user.id)
    return fail("NOT_FOUND", "Session not found.", 404);
  if (session.status === "completed") {
    return fail("VALIDATION_ERROR", "This session has already been analysed.", 409);
  }
  if (session.photos_count === 0) {
    return fail("VALIDATION_ERROR", "Upload at least one photo before analysing.", 422);
  }

  const admin = createAdminClient();
  await admin.from("braidcare_sessions").update({ status: "in_progress" }).eq("id", session.id);

  const result = await runAnalysis(admin, session.id);
  if (!result.ok) {
    return ok({
      status: "queued",
      message: "Your analysis is taking longer than expected. We'll notify you when it's ready.",
    });
  }

  return ok({ session: result.session });
}
