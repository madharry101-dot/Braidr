import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ErrorCode } from "@/lib/api/errors";

// Free tier allocation per confirmed booking. Kept as a constant here AND
// as bookings.sessions_allocated (default 3) so an admin could grant a
// booking extra sessions later without a code change.
export const FREE_SESSIONS_PER_BOOKING = 3;

export type EligibilityResult =
  | {
      ok: true;
      reason: "subscription";
      booking: null;
    }
  | {
      ok: true;
      reason: "free_booking_window";
      booking: { id: string; sessions_used: number; sessions_allocated: number };
    }
  | { ok: false; code: ErrorCode; message: string };

/**
 * BraidCare access — the two-path model (plan §1.1a, which supersedes the
 * "no session cap" wording in PRD v2.0 §4.4 / TRD v2.0 §3.3.1):
 *
 *   1. Active £7.99/mo subscription  -> unlimited, no window, no cap, no
 *                                        booking required.
 *   2. A confirmed, paid booking, from `braidcare_live_at` (24h before the
 *      appointment) onwards, capped at `sessions_allocated` (3) checks.
 *      No upper time bound — the cap is the only limit (Q4a).
 *
 * `bookingId` is optional: a subscriber can start a standalone session with
 * none. A non-subscriber with no bookingId gets NO_BOOKING_OR_SUBSCRIPTION.
 */
export async function checkBraidcareEligibility(
  supabase: SupabaseClient<Database>,
  clientId: string,
  bookingId?: string | null
): Promise<EligibilityResult> {
  // Path 1 — active subscription.
  const { data: sub } = await supabase
    .from("braidcare_subscriptions")
    .select("status")
    .eq("user_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (sub) return { ok: true, reason: "subscription", booking: null };

  // Path 2 — free access via a confirmed booking.
  if (!bookingId) {
    return {
      ok: false,
      code: "NO_BOOKING_OR_SUBSCRIPTION",
      message:
        "BraidCare unlocks free with a booking, or any time with a £7.99/month subscription.",
    };
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, braidcare_live_at, sessions_allocated, sessions_used")
    .eq("id", bookingId)
    .eq("client_id", clientId)
    .single();

  if (!booking) {
    return { ok: false, code: "BOOKING_NOT_FOUND", message: "No booking found with that ID." };
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
      (new Date(booking.braidcare_live_at).getTime() - Date.now()) / 3_600_000
    );
    return {
      ok: false,
      code: "WINDOW_NOT_OPEN",
      message: `BraidCare activates ${hoursRemaining} hours before your appointment.`,
    };
  }
  if (booking.sessions_used >= booking.sessions_allocated) {
    return {
      ok: false,
      code: "NO_SESSIONS_LEFT",
      message:
        "You've used all 3 BraidCare checks for this booking. Subscribe for unlimited checks.",
    };
  }

  return { ok: true, reason: "free_booking_window", booking };
}
