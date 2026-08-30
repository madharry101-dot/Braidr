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

  const isBraiderViewer = braiderProfile?.user_id === user.id;

  // Split by permission, not by convenience:
  //   * the braider's name is public                       -> public_profiles
  //   * a client's details are for the braider they booked  -> braider_client_profiles
  //     (name, phone, and the braider-confirmed hair type only — never
  //     stripe_customer_id / referral_code / date_of_birth)
  // A client viewing their own booking doesn't need client_name at all (the
  // detail screen shows them the braider), so that read only runs for the
  // braider side.
  const [{ data: braiderPerson }, { data: clientPerson }] = await Promise.all([
    braiderProfile?.user_id
      ? supabase
          .from("public_profiles")
          .select("id, name")
          .eq("id", braiderProfile.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isBraiderViewer
      ? supabase
          .from("braider_client_profiles")
          .select("id, name, hair_type")
          .eq("id", booking.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return ok({
    booking: {
      ...booking,
      service_name: service?.name ?? "Service",
      service_duration_mins: service?.duration_mins ?? null,
      service_category: service?.category ?? null,
      braider_name: braiderPerson?.name ?? "Braider",
      client_name: clientPerson?.name ?? null,
      // Present only for the braider viewer. Non-null means a braider has
      // already confirmed it; null means it hasn't been recorded yet (a
      // client's own self-report is not shared with the braider).
      ...(isBraiderViewer ? { client_hair_type: clientPerson?.hair_type ?? null } : {}),
    },
  });
}
