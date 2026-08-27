import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

// GET /api/braidcare/overview — everything the /braidcare landing screen
// needs in one call: the client's subscription state, their confirmed
// bookings annotated with BraidCare availability (window open? sessions
// left?), and their session history. Not in the TRD endpoint table — the
// per-resource routes exist, but the screen would otherwise need 3+ calls
// and re-derive the eligibility maths the server already owns
// (lib/braidcare/eligibility.ts).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const [{ data: profile }, { data: bookings }, { data: sessions }] = await Promise.all([
    supabase.from("profiles").select("braidcare_client_subscribed").eq("id", user.id).single(),
    supabase
      .from("bookings")
      .select(
        "id, service_id, braider_id, appointment_at, braidcare_live_at, sessions_allocated, sessions_used, sessions_purchased"
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

  const clientSubscribed = profile?.braidcare_client_subscribed ?? false;
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
    const sessionsRemaining = b.sessions_allocated + b.sessions_purchased - b.sessions_used;
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
      can_start: windowOpen && (clientSubscribed || sessionsRemaining > 0),
    };
  });

  return ok({
    client_subscribed: clientSubscribed,
    bookings: annotated,
    sessions: sessions ?? [],
  });
}
