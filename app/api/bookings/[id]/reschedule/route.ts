import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { rescheduleBookingSchema } from "@/lib/validations/booking";
import { ok, fail } from "@/lib/api/response";
import { sendEmail } from "@/lib/email/send";

// POST /api/bookings/:id/reschedule — TRD 4.4 / PRD FR-MATCH-02.7. Proposes
// a new time; appointment_at (and therefore braidcare_live_at) doesn't
// change until the other participant calls confirm-reschedule. See the
// booking_reschedule migration note for why pending_reschedule_at exists.
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(rescheduleBookingSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { new_appointment_at } = parsed.data;

  if (new Date(new_appointment_at).getTime() <= Date.now()) {
    return fail("APPOINTMENT_IN_PAST", "New appointment time must be in the future.", 422);
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, client_id, braider_id, status")
    .eq("id", params.id)
    .single();

  if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
  if (booking.status !== "confirmed") {
    return fail("BOOKING_NOT_CONFIRMED", "Only a confirmed booking can be rescheduled.", 409);
  }

  let otherPartyUserId: string;
  if (user.id === booking.client_id) {
    const { data: braiderProfile } = await supabase
      .from("braider_profiles")
      .select("user_id")
      .eq("id", booking.braider_id)
      .single();
    if (!braiderProfile)
      return fail("INTERNAL_ERROR", "Could not resolve booking participants.", 500);
    otherPartyUserId = braiderProfile.user_id;
  } else {
    otherPartyUserId = booking.client_id;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("bookings")
    .update({ pending_reschedule_at: new_appointment_at, reschedule_requested_by: user.id })
    .eq("id", params.id);
  if (error) return fail("INTERNAL_ERROR", "Failed to request reschedule.", 500);

  const { data: otherPartyUser } = await admin.auth.admin.getUserById(otherPartyUserId);
  if (otherPartyUser?.user?.email) {
    await sendEmail({
      to: otherPartyUser.user.email,
      subject: "Braidr — a reschedule has been proposed",
      text: `Your booking has a proposed new time: ${new Date(new_appointment_at).toLocaleString("en-GB")}. Sign in to confirm or decline.`,
    });
  }

  return ok({ pending_reschedule_at: new_appointment_at });
}
