import type { createAdminClient } from "@/lib/supabase/admin";
import { runAnalysis } from "@/lib/braidcare/run-analysis";
import { sendEmail } from "@/lib/email/send";

const RETRY_AFTER_MINUTES = 2; // avoid racing a request still actively in flight
const GIVE_UP_AFTER_HOURS = 4; // TRD 5.4

// Extracted for the same reason as lib/cron/release-payouts.ts — called
// in-process by /api/cron/daily.
export async function runRetryBraidcareAnalysis(admin: ReturnType<typeof createAdminClient>) {
  const retryEligibleBefore = new Date(Date.now() - RETRY_AFTER_MINUTES * 60_000).toISOString();
  const giveUpBefore = new Date(Date.now() - GIVE_UP_AFTER_HOURS * 60 * 60_000).toISOString();

  const { data: stale, error } = await admin
    .from("braidcare_sessions")
    .select("id, client_id, created_at")
    .eq("status", "in_progress")
    .lte("created_at", retryEligibleBefore);

  if (error) throw new Error(`Failed to query stuck sessions: ${error.message}`);

  const results: Array<{ session_id: string; outcome: "completed" | "retrying" | "expired" }> = [];

  for (const session of stale ?? []) {
    if (session.created_at <= giveUpBefore) {
      await admin.from("braidcare_sessions").update({ status: "expired" }).eq("id", session.id);
      const { data: clientUser } = await admin.auth.admin.getUserById(session.client_id);
      if (clientUser?.user?.email) {
        await sendEmail({
          to: clientUser.user.email,
          subject: "We couldn't complete your BraidCare analysis",
          text: "We tried repeatedly but couldn't finish analysing your photos. This session wasn't charged — please start a new one.",
        });
      }
      results.push({ session_id: session.id, outcome: "expired" });
      continue;
    }

    const result = await runAnalysis(admin, session.id);
    results.push({ session_id: session.id, outcome: result.ok ? "completed" : "retrying" });
  }

  return { processed: results.length, results };
}
