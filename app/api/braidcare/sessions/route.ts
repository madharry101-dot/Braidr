import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { initiateSessionSchema } from "@/lib/validations/braidcare";
import { checkBraidcareEligibility } from "@/lib/braidcare/eligibility";
import { ok, fail } from "@/lib/api/response";

// POST /api/braidcare/sessions — TRD 4.5 / v2.0 §1.1a. Starts a session.
//   - free tier: booking_id required; capped at 3 per booking
//   - subscriber: booking_id optional; if omitted, a standalone session
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(initiateSessionSchema, await request.json().catch(() => ({})));
  if (!parsed.ok) return parsed.response;
  const bookingId = parsed.data.booking_id ?? null;

  const eligibility = await checkBraidcareEligibility(supabase, user.id, bookingId);
  if (!eligibility.ok) return fail(eligibility.code, eligibility.message, 403);

  // session_number is a display label. Against a booking it counts that
  // booking's sessions; standalone it counts the client's standalone ones.
  let sessionNumber = 1;
  if (eligibility.reason === "free_booking_window") {
    sessionNumber = eligibility.booking.sessions_used + 1;
  } else {
    const { count } = await supabase
      .from("braidcare_sessions")
      .select("id", { count: "exact", head: true })
      .eq("client_id", user.id)
      .is("booking_id", null);
    sessionNumber = (count ?? 0) + 1;
  }

  const { data: session, error } = await supabase
    .from("braidcare_sessions")
    .insert({
      booking_id: bookingId,
      client_id: user.id,
      session_number: sessionNumber,
      session_type: eligibility.reason === "subscription" ? "subscription" : "included",
    })
    .select("id, session_number, session_type, status")
    .single();

  if (error || !session) return fail("INTERNAL_ERROR", "Failed to start session.", 500);
  return ok({ session }, 201);
}

// GET /api/braidcare/sessions — TRD 4.5. List all sessions for current client.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: sessions, error } = await supabase
    .from("braidcare_sessions")
    .select(
      "id, booking_id, session_number, session_type, status, overall_status, summary, referral_suggested, report_delivered_at, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) return fail("INTERNAL_ERROR", "Failed to load sessions.", 500);
  return ok({ sessions });
}
