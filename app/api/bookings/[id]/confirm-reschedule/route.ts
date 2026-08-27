import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/response";
import { sendEmail } from "@/lib/email/send";

// POST /api/bookings/:id/confirm-reschedule — TRD 4.4. Must be called by
// the participant who did NOT request the reschedule. Updating appointment_at
// here is what actually moves braidcare_live_at — it's a generated column,
// so Postgres recalculates it automatically on this UPDATE.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, client_id, braider_id, pending_reschedule_at, reschedule_requested_by")
    .eq("id", params.id)
    .single();

  if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
  if (!booking.pending_reschedule_at) {
    return fail("RESCHEDULE_NOT_PENDING", "There is no pending reschedule on this booking.", 409);
  }
  if (booking.reschedule_requested_by === user.id) {
    return fail("FORBIDDEN", "The party who proposed the reschedule can't also confirm it.", 403);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("bookings")
    .update({
      appointment_at: booking.pending_reschedule_at,
      pending_reschedule_at: null,
      reschedule_requested_by: null,
    })
    .eq("id", params.id);
  if (error) return fail("INTERNAL_ERROR", "Failed to confirm reschedule.", 500);

  const { data: requester } = booking.reschedule_requested_by
    ? await admin.auth.admin.getUserById(booking.reschedule_requested_by)
    : { data: null };
  if (requester?.user?.email) {
    await sendEmail({
      to: requester.user.email,
      subject: "Braidr — your reschedule was confirmed",
      text: `The new appointment time (${new Date(booking.pending_reschedule_at).toLocaleString("en-GB")}) has been confirmed.`,
    });
  }

  return ok({ appointment_at: booking.pending_reschedule_at });
}
