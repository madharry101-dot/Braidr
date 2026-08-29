import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { ok, fail } from "@/lib/api/response";

// GDPR-07 (Article 15/20). Logs a data-export request for the 30-day
// statutory response window. Fulfilment is currently manual — the Privacy
// Policy promises a secure link within 48 hours.

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: pending } = await supabase
    .from("data_export_requests")
    .select("id, status, requested_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  return ok({ pending: pending ?? null });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: existing } = await supabase
    .from("data_export_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return ok({ already_requested: true });
  }

  const { error } = await supabase.from("data_export_requests").insert({ user_id: user.id });
  if (error) return fail("INTERNAL_ERROR", "Could not submit your request.", 500);

  // Notify the user and flag it for the team to fulfil.
  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  if (authUser?.user?.email) {
    await sendEmail({
      to: authUser.user.email,
      subject: "We've received your data request",
      text: "We've started preparing your data. We'll email you a secure download link within 48 hours.",
    });
  }
  await sendEmail({
    to: "privacy@braidr.app",
    subject: "Data export request",
    text: `User ${user.id} requested a data export.`,
  });

  return ok({ requested: true });
}
