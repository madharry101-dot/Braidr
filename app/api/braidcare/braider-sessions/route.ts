import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

// GET /api/braidcare/braider-sessions — the subscribed braider's view of
// their clients' BraidCare activity. Deliberately a separate route from
// GET /api/braidcare/sessions: the column grant on braidcare_sessions
// lets `authenticated` read `summary` too, so the "braider sees flags,
// never the summary text or photos" rule (concept doc / PRD FR-CARE-03) is
// enforced here by the explicit column list — no `summary`, no
// `photo_paths` (the latter isn't grantable to authenticated at all).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: braider } = await supabase
    .from("braider_profiles")
    .select("id, braidcare_subscribed")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!braider) {
    return fail("ROLE_MISMATCH", "Only braiders can view this.", 403);
  }
  if (!braider.braidcare_subscribed) {
    return ok({ subscribed: false, sessions: [] });
  }

  // RLS (braidcare_sessions_select_client_or_braider) already limits rows to
  // this braider's bookings; the column list is what withholds the summary.
  const { data: sessions } = await supabase
    .from("braidcare_sessions")
    .select(
      "id, booking_id, client_id, session_number, status, overall_status, condition_flags, referral_suggested, report_delivered_at, created_at"
    )
    .eq("status", "completed")
    .order("report_delivered_at", { ascending: false });

  // A braider only ever sees sessions tied to one of their bookings (RLS);
  // standalone subscriber sessions (booking_id null) never reach here.
  const rows = (sessions ?? []).filter(
    (s): s is typeof s & { booking_id: string } => s.booking_id !== null
  );
  const bookingIds = [...new Set(rows.map((s) => s.booking_id))];
  const clientIds = [...new Set(rows.map((s) => s.client_id))];

  const [{ data: bookings }, { data: clients }] = await Promise.all([
    supabase.from("bookings").select("id, service_id, appointment_at").in("id", bookingIds),
    supabase.from("profiles").select("id, display_name, full_name").in("id", clientIds),
  ]);

  const serviceIds = [...new Set((bookings ?? []).map((b) => b.service_id))];
  const { data: services } = await supabase
    .from("services")
    .select("id, name")
    .in("id", serviceIds);

  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]));
  const serviceName = new Map((services ?? []).map((s) => [s.id, s.name]));
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.display_name ?? c.full_name]));

  const hydrated = rows.map((s) => {
    const b = bookingById.get(s.booking_id);
    return {
      id: s.id,
      session_number: s.session_number,
      overall_status: s.overall_status,
      condition_flags: s.condition_flags,
      referral_suggested: s.referral_suggested,
      report_delivered_at: s.report_delivered_at,
      client_name: clientName.get(s.client_id) ?? "Client",
      service_name: b ? (serviceName.get(b.service_id) ?? "Appointment") : "Appointment",
      appointment_at: b?.appointment_at ?? null,
    };
  });

  return ok({ subscribed: true, sessions: hydrated });
}
