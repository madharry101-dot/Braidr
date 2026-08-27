import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ErrorCode } from "@/lib/api/errors";

export type EligibilityResult =
  | {
      ok: true;
      booking: {
        id: string;
        sessions_used: number;
        sessions_allocated: number;
        sessions_purchased: number;
      };
      clientSubscribed: boolean;
    }
  | { ok: false; code: ErrorCode; message: string };

/**
 * TRD 4.5.1 — validation order is significant (each check's error code is
 * specific and tested for in TRD 8.2.1's test table); do not reorder or
 * collapse these into a single query.
 *
 *   1. booking_id belongs to authenticated client       -> BOOKING_NOT_FOUND
 *   2. booking.status === 'confirmed'                   -> BOOKING_NOT_CONFIRMED
 *   3. now() >= booking.braidcare_live_at                -> WINDOW_NOT_OPEN
 *   4. (sessions_allocated + sessions_purchased
 *       - sessions_used) > 0                              -> NO_SESSIONS_LEFT
 *
 * A client with an active BraidCare subscription (unlimited, PRD
 * FR-CARE-01.7) bypasses check 4 entirely — that's a schema addition beyond
 * the TRD's literal counter formula (see the braidcare_subscriptions
 * migration note), needed because the formula alone has no way to express
 * "unlimited".
 */
export async function checkBraidcareEligibility(
  supabase: SupabaseClient<Database>,
  clientId: string,
  bookingId: string
): Promise<EligibilityResult> {
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, braidcare_live_at, sessions_allocated, sessions_used, sessions_purchased")
    .eq("id", bookingId)
    .eq("client_id", clientId)
    .single();

  if (!booking) {
    return {
      ok: false,
      code: "BOOKING_NOT_FOUND",
      message: "No booking found with the provided ID.",
    };
  }
  if (booking.status !== "confirmed") {
    return {
      ok: false,
      code: "BOOKING_NOT_CONFIRMED",
      message: "This booking is not yet confirmed.",
    };
  }
  if (new Date(booking.braidcare_live_at).getTime() > Date.now()) {
    const hoursRemaining = Math.ceil(
      (new Date(booking.braidcare_live_at).getTime() - Date.now()) / (60 * 60 * 1000)
    );
    return {
      ok: false,
      code: "WINDOW_NOT_OPEN",
      message: `BraidCare activates ${hoursRemaining} hours before your appointment.`,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("braidcare_client_subscribed")
    .eq("id", clientId)
    .single();

  const sessionsRemaining =
    booking.sessions_allocated + booking.sessions_purchased - booking.sessions_used;

  const clientSubscribed = profile?.braidcare_client_subscribed ?? false;

  if (!clientSubscribed && sessionsRemaining <= 0) {
    return {
      ok: false,
      code: "NO_SESSIONS_LEFT",
      message: "You have used all included sessions. Purchase more to continue.",
    };
  }

  return { ok: true, booking, clientSubscribed };
}
