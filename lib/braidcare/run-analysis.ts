import type { createAdminClient } from "@/lib/supabase/admin";
import { analyseScalp, computeReferralSuggested } from "@/lib/ai/braidcare";
import { sendEmail } from "@/lib/email/send";

/**
 * Shared by POST /api/braidcare/sessions/:id/analyse (first attempt) and
 * /api/cron/retry-braidcare-analysis (subsequent attempts on a session
 * that's still 'in_progress'). Idempotent from the caller's perspective —
 * always uses the admin client and never assumes a request/session context.
 */
export async function runAnalysis(admin: ReturnType<typeof createAdminClient>, sessionId: string) {
  const { data: session } = await admin
    .from("braidcare_sessions")
    .select("id, client_id, booking_id, photo_paths")
    .eq("id", sessionId)
    .single();
  if (!session) return { ok: false as const };

  try {
    const buffers = await Promise.all(
      session.photo_paths.map(async (path) => {
        const { data, error } = await admin.storage.from("scalp-photos").download(path);
        if (error || !data) throw new Error(`Failed to download ${path}: ${error?.message}`);
        return Buffer.from(await data.arrayBuffer());
      })
    );

    const analysis = await analyseScalp(buffers);
    const referral = computeReferralSuggested(analysis);

    const { data: updated, error } = await admin
      .from("braidcare_sessions")
      .update({
        status: "completed",
        ai_raw_response: analysis,
        overall_status: analysis.overall_status,
        summary: analysis.summary,
        condition_flags: analysis.flags,
        recommendations: analysis.recommendations,
        referral_suggested: referral.suggested,
        referral_threshold_met: referral.reason,
        report_delivered_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select(
        "id, session_number, overall_status, summary, condition_flags, recommendations, referral_suggested"
      )
      .single();
    if (error || !updated) return { ok: false as const };

    // Session only "consumes" quota on successful delivery (FR-CARE-02.8).
    await admin.rpc("increment_booking_sessions_used", { p_booking_id: session.booking_id });

    const { data: clientUser } = await admin.auth.admin.getUserById(session.client_id);
    if (clientUser?.user?.email) {
      const referralNote = referral.suggested
        ? "\n\nConsider speaking to a specialist — we've flagged something worth a professional look."
        : "";
      await sendEmail({
        to: clientUser.user.email,
        subject: "Your BraidCare report is ready",
        text: `${analysis.summary}${referralNote}`,
      });
    }

    return { ok: true as const, session: updated };
  } catch (err) {
    console.error(`[braidcare analyse] session ${sessionId} failed:`, err);
    return { ok: false as const };
  }
}
