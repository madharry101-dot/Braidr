import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

// GET /api/braidcare/overview — everything the /braidcare landing screen
// needs in one call: subscription state, confirmed bookings annotated with
// BraidCare availability, and session history.
//
// Access model (plan §1.1a): free = 3 checks per confirmed booking from 24h
// before the appointment; subscription (£7.99/mo) = unlimited, no booking
// required.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const [{ data: sub }, { data: bookings }, { data: sessions }] = await Promise.all([
    supabase
      .from("braidcare_subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select(
        "id, service_id, braider_id, appointment_at, braidcare_live_at, sessions_allocated, sessions_used"
      )
      .eq("status", "confirmed")
      .order("appointment_at", { ascending: true }),
    supabase
      .from("braidcare_sessions")
      .select(
        "id, booking_id, session_number, session_type, status, overall_status, summary, referral_suggested, report_delivered_at, created_at"
      )
      .order("created_at", { ascending: false }),
  ]);

  const subscribed = sub?.status === "active";
  const now = Date.now();

  const serviceIds = [...new Set((bookings ?? []).map((b) => b.service_id))];
  const braiderIds = [...new Set((bookings ?? []).map((b) => b.braider_id))];
  const [{ data: services }, { data: braiderProfiles }] = await Promise.all([
    supabase.from("services").select("id, name").in("id", serviceIds),
    supabase.from("braider_profiles").select("id, user_id").in("id", braiderIds),
  ]);
  const { data: people } = await supabase
    .from("profiles")
    .select("id, display_name, full_name")
    .in(
      "id",
      (braiderProfiles ?? []).map((b) => b.user_id)
    );

  const serviceName = new Map((services ?? []).map((s) => [s.id, s.name]));
  const braiderUser = new Map((braiderProfiles ?? []).map((b) => [b.id, b.user_id]));
  const personName = new Map((people ?? []).map((p) => [p.id, p.display_name ?? p.full_name]));

  const annotated = (bookings ?? []).map((b) => {
    const liveAt = new Date(b.braidcare_live_at).getTime();
    const windowOpen = now >= liveAt;
    const sessionsRemaining = b.sessions_allocated - b.sessions_used;
    return {
      booking_id: b.id,
      service_name: serviceName.get(b.service_id) ?? "Appointment",
      braider_name: personName.get(braiderUser.get(b.braider_id) ?? "") ?? "your braider",
      appointment_at: b.appointment_at,
      braidcare_live_at: b.braidcare_live_at,
      window_open: windowOpen,
      hours_until_open: windowOpen ? 0 : Math.ceil((liveAt - now) / 3_600_000),
      sessions_allocated: b.sessions_allocated,
      sessions_used: b.sessions_used,
      sessions_remaining: sessionsRemaining,
      can_start: subscribed || (windowOpen && sessionsRemaining > 0),
    };
  });

  return ok({
    client_subscribed: subscribed,
    subscription_period_end: sub?.current_period_end ?? null,
    bookings: annotated,
    sessions: sessions ?? [],
  });
}
