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

  // Split by permission, not by convenience: the braider's name is public
  // (public_profiles — see 20260911000001), the client's row is readable
  // only by the braider they booked with (profiles_select_own_clients).
  const [{ data: braiderPerson }, { data: clientPerson }] = await Promise.all([
    braiderProfile?.user_id
      ? supabase
          .from("public_profiles")
          .select("id, name")
          .eq("id", braiderProfile.user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("profiles")
      .select("id, display_name, full_name, hair_type, hair_type_source")
      .eq("id", booking.client_id)
      .maybeSingle(),
  ]);

  const personName = new Map<string, string>();
  if (braiderPerson) personName.set(braiderPerson.id, braiderPerson.name);
  if (clientPerson) {
    personName.set(clientPerson.id, clientPerson.display_name ?? clientPerson.full_name);
  }

  // The braider viewing their own booking also gets the client's hair type,
  // for the post-appointment "confirm or update" step (Part 1). Readable
  // via profiles_select_own_clients. Clients don't need it here — their own
  // value lives on /settings.
  const isBraiderViewer = braiderProfile?.user_id === user.id;
  const clientProfile = clientPerson;

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
      ...(isBraiderViewer
        ? {
            client_hair_type: clientProfile?.hair_type ?? null,
            client_hair_type_source: clientProfile?.hair_type_source ?? "self",
          }
        : {}),
    },
  });
}
