import type { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";

// R-04 follow-up — tell someone when the CSP actually blocks something.
//
// `csp_violation_reports` has been filling up since the policy went
// enforcing, and nothing has ever read it. The meaning of a row changed with
// that switch: in report-only a row was a sample, in enforce mode a row means
// something was genuinely BLOCKED for a real user. A signal nobody reads is
// not a signal.
//
// ONE NOISY DAY SENDS ONE EMAIL. `last_alerted_at` is both the point new rows
// are counted from and the throttle. Alerting moves the watermark, so a
// second run on the same day has nothing new to report; and if rows keep
// arriving, THROTTLE_HOURS stops a fresh email every time the cron is poked.
// A fixed "last 24 hours" lookback would double-report when the cron runs
// twice and lose everything when it misses a day.

const ALERT_KEY = "csp_violations";
const THROTTLE_HOURS = 24;
/** How many examples to put in the email. Enough to recognise the problem, not a dump. */
const SAMPLE_SIZE = 10;

type AlertOutcome = {
  new_reports: number;
  alerted: boolean;
  reason: "sent" | "nothing_new" | "throttled" | "initialised" | "no_recipient";
};

export async function runCspViolationAlert(
  admin: ReturnType<typeof createAdminClient>
): Promise<AlertOutcome> {
  const { data: state, error: stateError } = await admin
    .from("cron_alert_state")
    .select("last_alerted_at")
    .eq("alert_key", ALERT_KEY)
    .maybeSingle();
  if (stateError) throw new Error(`cron_alert_state read failed: ${stateError.message}`);

  // First ever run: set the watermark to now and say nothing. Alerting on
  // whatever happens to be in the table already would be a one-off blast
  // about history rather than a signal about now.
  if (!state) {
    const { error } = await admin
      .from("cron_alert_state")
      .insert({ alert_key: ALERT_KEY, last_alerted_at: new Date().toISOString() });
    if (error) throw new Error(`cron_alert_state init failed: ${error.message}`);
    console.info("[csp-alert] first run — watermark initialised, not alerting on history.");
    return { new_reports: 0, alerted: false, reason: "initialised" };
  }

  const since = state.last_alerted_at;
  const { count, error: countError } = await admin
    .from("csp_violation_reports")
    .select("id", { count: "exact", head: true })
    .gt("created_at", since);
  if (countError) throw new Error(`csp_violation_reports count failed: ${countError.message}`);

  const newReports = count ?? 0;
  if (newReports === 0) return { new_reports: 0, alerted: false, reason: "nothing_new" };

  const hoursSince = (Date.now() - new Date(since).getTime()) / 3_600_000;
  if (hoursSince < THROTTLE_HOURS) {
    console.info(
      `[csp-alert] ${newReports} new report(s), but last alert was ${hoursSince.toFixed(1)}h ago — holding until ${THROTTLE_HOURS}h.`
    );
    return { new_reports: newReports, alerted: false, reason: "throttled" };
  }

  const recipient = process.env.CSP_ALERT_EMAIL;
  if (!recipient) {
    // Loudly, not silently. The whole point of this task is that nobody was
    // watching; failing quietly here would recreate exactly that.
    console.error(
      `[csp-alert] ${newReports} new CSP violation(s) and CSP_ALERT_EMAIL is not set — NOBODY IS BEING TOLD. Set it in the deploy environment.`
    );
    return { new_reports: newReports, alerted: false, reason: "no_recipient" };
  }

  const { data: sample } = await admin
    .from("csp_violation_reports")
    .select("created_at, effective_directive, violated_directive, blocked_uri, document_uri")
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(SAMPLE_SIZE);

  const lines = (sample ?? []).map((r) => {
    const directive = r.effective_directive ?? r.violated_directive ?? "unknown directive";
    return `  ${directive} blocked ${r.blocked_uri ?? "(inline)"} on ${r.document_uri ?? "(unknown page)"}`;
  });

  await sendEmail({
    to: recipient,
    subject: `Braidr: ${newReports} Content-Security-Policy violation${newReports === 1 ? "" : "s"}`,
    text: [
      `${newReports} Content-Security-Policy violation${newReports === 1 ? " was" : "s were"} reported since ${new Date(since).toUTCString()}.`,
      "",
      "The policy is enforcing, so each of these is something a browser actually",
      "blocked for someone using the site — not a warning.",
      "",
      lines.length > 0 ? `Most recent ${lines.length}:` : "",
      ...lines,
      newReports > lines.length ? `  ...and ${newReports - lines.length} more.` : "",
      "",
      "Check the csp_violation_reports table for the full picture. If these are",
      "legitimate, the policy in next.config.mjs needs widening; if they are not,",
      "something is trying to load what it should not.",
    ]
      .filter((l) => l !== "")
      .join("\n"),
  });

  const { error: updateError } = await admin
    .from("cron_alert_state")
    .update({ last_alerted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("alert_key", ALERT_KEY);
  // The email has gone. If the watermark did not move we will re-send
  // tomorrow, which is annoying but not harmful — so say so rather than
  // failing the whole cron run over it.
  if (updateError) {
    console.error(
      `[csp-alert] alert sent but watermark update FAILED — expect a duplicate tomorrow: ${updateError.message}`
    );
  }

  return { new_reports: newReports, alerted: true, reason: "sent" };
}
