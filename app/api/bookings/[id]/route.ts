import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

// GET /api/bookings/:id — TRD 4.4. RLS (bookings_select_participant) already
// restricts this to the client or braider on the booking; a non-participant
// gets 0 rows back, which we surface as 404.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);

  // Hydrate the display names the detail screen needs (same RLS reasoning
  // as the list route).
  const [{ data: service }, { data: braiderProfile }] = await Promise.all([
    supabase
      .from("services")
      .select("name, duration_mins, category")
      .eq("id", booking.service_id)
      .single(),
    supabase.from("braider_profiles").select("user_id").eq("id", booking.braider_id).single(),
  ]);

  const nameIds = [booking.client_id];
  if (braiderProfile?.user_id) nameIds.push(braiderProfile.user_id);
  const { data: people } = await supabase
    .from("profiles")
    .select("id, display_name, full_name")
    .in("id", nameIds);
  const personName = new Map((people ?? []).map((p) => [p.id, p.display_name ?? p.full_name]));

  return ok({
    booking: {
      ...booking,
      service_name: service?.name ?? "Service",
      service_duration_mins: service?.duration_mins ?? null,
      service_category: service?.category ?? null,
      braider_name: braiderProfile?.user_id
        ? (personName.get(braiderProfile.user_id) ?? "Braider")
        : "Braider",
      client_name: personName.get(booking.client_id) ?? null,
    },
  });
}
