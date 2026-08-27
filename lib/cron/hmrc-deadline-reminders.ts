import type { createAdminClient } from "@/lib/supabase/admin";
import { isReminderDay } from "@/lib/pro/hmrc-deadlines";
import { sendEmail } from "@/lib/email/send";

// Extracted for the same reason as lib/cron/release-payouts.ts — called
// in-process by /api/cron/daily. PRD FR-PRO-03.5.
export async function runHmrcDeadlineReminders(admin: ReturnType<typeof createAdminClient>) {
  const { isReminderDay: shouldRemind, deadline } = isReminderDay(new Date());
  if (!shouldRemind) return { sent: 0, reason: "not a reminder day" };

  const { data: registered, error } = await admin
    .from("braidr_pro_progress")
    .select("braider_id")
    .eq("step2_hmrc_completed", true);
  if (error) throw new Error(`Failed to query registered braiders: ${error.message}`);

  let sent = 0;
  for (const row of registered ?? []) {
    const { data: braiderProfile } = await admin
      .from("braider_profiles")
      .select("user_id")
      .eq("id", row.braider_id)
      .single();
    if (!braiderProfile) continue;

    const { data: user } = await admin.auth.admin.getUserById(braiderProfile.user_id);
    if (!user?.user?.email) continue;

    await sendEmail({
      to: user.user.email,
      subject: "HMRC Self Assessment deadline reminder",
      text: `Your Self Assessment tax return is due by ${deadline.toLocaleDateString("en-GB")}. This is a reminder only — Braidr does not provide tax advice; consult an accountant if you're unsure.`,
    });
    sent += 1;
  }

  return { sent, deadline: deadline.toISOString() };
}
