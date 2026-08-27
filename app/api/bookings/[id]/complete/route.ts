import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/response";
import { sendEmail } from "@/lib/email/send";

// POST /api/bookings/:id/complete — TRD 4.4, braider-owner only. Does NOT
// trigger the Stripe transfer directly — under the separate-charges-and-
// transfers model, the actual payout is released by the
// /api/cron/release-payouts job once the 24-hour hold (from this
// completed_at) has passed. This route only flips the booking's status.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, client_id, braider_id, status, appointment_at")
    .eq("id", params.id)
    .single();

  if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("user_id")
    .eq("id", booking.braider_id)
    .single();
  if (!braiderProfile || braiderProfile.user_id !== user.id) {
    return fail("FORBIDDEN", "Only the braider on this booking can mark it complete.", 403);
  }

  if (booking.status !== "confirmed") {
    return fail("BOOKING_NOT_CONFIRMED", "Only a confirmed booking can be marked complete.", 409);
  }
  if (new Date(booking.appointment_at).getTime() > Date.now()) {
    return fail("APPOINTMENT_NOT_YET_OCCURRED", "This appointment hasn't happened yet.", 422);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("bookings")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return fail("INTERNAL_ERROR", "Failed to mark booking complete.", 500);

  const { data: clientUser } = await admin.auth.admin.getUserById(booking.client_id);
  if (clientUser?.user?.email) {
    // PRD FR-MATCH-02.9 (P2): review prompt "2 hours after completion" —
    // sent immediately here rather than delayed, since there's no scheduled
    // task queue wired up yet for a precise 2-hour delay. Close enough for
    // now; revisit if the timing itself turns out to matter for review rates.
    await sendEmail({
      to: clientUser.user.email,
      subject: "How was your Braidr appointment?",
      text: "Your appointment is marked complete. Sign in to leave a review for your braider.",
    });
  }

  return ok({ status: "completed" });
}
