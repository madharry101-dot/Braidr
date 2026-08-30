import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { confirmHairTypeSchema } from "@/lib/validations/booking";
import { ok, fail } from "@/lib/api/response";

// POST /api/bookings/:id/confirm-hair-type — Part 1. The braider on a
// completed (or past confirmed) booking confirms or overrides the client's
// self-reported hair type. Always optional: nothing in the appointment
// flow depends on it, and /complete never calls it.
//
// Writes with the service-role client because
// prevent_profile_privileged_field_update() only lets the platform stamp
// hair_type_source = 'braider_confirmed' — a braider must not be able to
// set that through a raw REST call with their own session.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(confirmHairTypeSchema, await request.json());
  if (!parsed.ok) return parsed.response;

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
    return fail("FORBIDDEN", "Only the braider on this booking can confirm a hair type.", 403);
  }

  // Only after the appointment has actually happened — this is a
  // post-appointment observation, not something a braider can assert at
  // booking time.
  if (booking.status !== "completed" && booking.status !== "confirmed") {
    return fail("BOOKING_NOT_CONFIRMED", "This booking isn't confirmed or completed.", 409);
  }
  if (new Date(booking.appointment_at).getTime() > Date.now()) {
    return fail("APPOINTMENT_NOT_YET_OCCURRED", "This appointment hasn't happened yet.", 422);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      hair_type: parsed.data.hair_type,
      hair_type_source: "braider_confirmed",
      hair_type_confirmed_by: user.id,
      hair_type_confirmed_at: new Date().toISOString(),
    })
    .eq("id", booking.client_id);
  if (error) {
    console.error("[confirm-hair-type] update failed", error);
    return fail("INTERNAL_ERROR", "Couldn't save the hair type.", 500);
  }

  return ok({ hair_type: parsed.data.hair_type, source: "braider_confirmed" });
}
