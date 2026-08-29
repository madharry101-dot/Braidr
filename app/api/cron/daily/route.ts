import { createAdminClient } from "@/lib/supabase/admin";
import { runReleasePayouts } from "@/lib/cron/release-payouts";
import { runRetryBraidcareAnalysis } from "@/lib/cron/retry-braidcare-analysis";
import { runHmrcDeadlineReminders } from "@/lib/cron/hmrc-deadline-reminders";
import { runPurgeBraidcarePhotos } from "@/lib/cron/purge-braidcare-photos";
import { ok, fail } from "@/lib/api/response";

// GET /api/cron/daily — the only cron actually registered in vercel.json.
// Vercel's Hobby plan caps both cron *frequency* (daily) and cron *job
// count* (2) — running three separate daily tasks would need three
// registered crons, over that limit. This single entry runs all three
// in-process instead. If/when the plan is upgraded (the pending decision
// already flagged to Harrison about BraidCare retry frequency), these can
// be split back into independently-scheduled crons at whatever cadence
// each actually needs — release-payouts and retry-braidcare-analysis
// benefit from running more than once a day; hmrc-deadline-reminders
// genuinely only needs to run once daily regardless.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return fail("UNAUTHENTICATED", "Not authorized.", 401);
  }

  const admin = createAdminClient();
  const results: Record<string, unknown> = {};

  for (const [name, task] of Object.entries({
    release_payouts: () => runReleasePayouts(admin),
    retry_braidcare_analysis: () => runRetryBraidcareAnalysis(admin),
    hmrc_deadline_reminders: () => runHmrcDeadlineReminders(admin),
    purge_braidcare_photos: () => runPurgeBraidcarePhotos(admin),
  })) {
    try {
      results[name] = await task();
    } catch (e) {
      results[name] = { error: e instanceof Error ? e.message : "unknown error" };
    }
  }

  return ok(results);
}
