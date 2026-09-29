import { createAdminClient } from "@/lib/supabase/admin";
import { runReleasePayouts } from "@/lib/cron/release-payouts";
import { runRetryBraidcareAnalysis } from "@/lib/cron/retry-braidcare-analysis";
import { runHmrcDeadlineReminders } from "@/lib/cron/hmrc-deadline-reminders";
import { runPurgeBraidcarePhotos } from "@/lib/cron/purge-braidcare-photos";
import { runAccountDeletion } from "@/lib/cron/account-deletion";
import { runExpireStaleBookings } from "@/lib/cron/expire-stale-bookings";
import { sendQueuedNewsletters } from "@/lib/cron/send-newsletter";
import { runPurgeStripeWebhookEvents } from "@/lib/cron/purge-stripe-webhook-events";
import { runCspViolationAlert } from "@/lib/cron/csp-violation-alert";
import { ok } from "@/lib/api/response";
import { rejectUnauthorisedCron } from "@/lib/cron/auth";

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
  const unauthorised = rejectUnauthorisedCron(request);
  if (unauthorised) return unauthorised;

  const admin = createAdminClient();
  const results: Record<string, unknown> = {};

  for (const [name, task] of Object.entries({
    release_payouts: () => runReleasePayouts(admin),
    retry_braidcare_analysis: () => runRetryBraidcareAnalysis(admin),
    hmrc_deadline_reminders: () => runHmrcDeadlineReminders(admin),
    purge_braidcare_photos: () => runPurgeBraidcarePhotos(admin),
    account_deletion: () => runAccountDeletion(admin),
    expire_stale_bookings: () => runExpireStaleBookings(admin),
    // Also has its own 15-minute cron; included here as a safety net so a
    // queued send is never stranded if that one stops firing.
    newsletter: () => sendQueuedNewsletters(),
    // R-06 dedup ledger housekeeping — finished rows older than the retention
    // window. Nothing else removes them.
    purge_stripe_webhook_events: () => runPurgeStripeWebhookEvents(admin),
    // R-04 follow-up — the CSP has been enforcing and collecting violation
    // reports that nobody reads. One email per noisy day, not per report.
    csp_violation_alert: () => runCspViolationAlert(admin),
  })) {
    try {
      results[name] = await task();
    } catch (e) {
      results[name] = { error: e instanceof Error ? e.message : "unknown error" };
    }
  }

  return ok(results);
}
