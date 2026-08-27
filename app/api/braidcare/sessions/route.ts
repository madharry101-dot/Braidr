import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { initiateSessionSchema } from "@/lib/validations/braidcare";
import { checkBraidcareEligibility } from "@/lib/braidcare/eligibility";
import { ok, fail } from "@/lib/api/response";

// POST /api/braidcare/sessions — TRD 4.5 / 4.5.1. Initiates a session
// against an already-eligible booking. session_type/session_number are
// derived from the booking's counters, not pre-allocated (see the Sprint 2
// webhook fix note — 3 rows are not created up front; "sessions_allocated
// = 3" on the booking IS the allocation).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(initiateSessionSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const eligibility = await checkBraidcareEligibility(supabase, user.id, parsed.data.booking_id);
  if (!eligibility.ok) return fail(eligibility.code, eligibility.message, 403);

  const { booking, clientSubscribed } = eligibility;
  // Session_number labels which attempt this is; it's assigned at
  // initiation, but sessions_used only increments on successful report
  // delivery (PRD FR-CARE-02.8: "consumed once report is delivered") — see
  // the /analyse route. Consequence, accepted as a minor cosmetic
  // simplification: if a client abandons a session before analysis, the
  // next one they start reuses the same session_number rather than
  // skipping ahead. Each row still has its own id, so nothing is actually
  // ambiguous — just a display-label quirk, not a functional bug.
  const sessionNumber = booking.sessions_used + 1;
  const sessionType = clientSubscribed
    ? "subscription"
    : sessionNumber <= booking.sessions_allocated
      ? "included"
      : "purchased_oneoff";

  const { data: session, error } = await supabase
    .from("braidcare_sessions")
    .insert({
      booking_id: booking.id,
      client_id: user.id,
      session_number: sessionNumber,
      session_type: sessionType,
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
