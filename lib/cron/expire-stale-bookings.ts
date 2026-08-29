import type { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";

// Safety net for pending bookings whose checkout was abandoned and whose
// checkout.session.expired webhook never landed. The Checkout Session
// expires after 30 minutes, so anything still 'pending' an hour after
// creation is definitively dead — release its slot.
const STALE_AFTER_MINUTES = 60;

export async function runExpireStaleBookings(admin: ReturnType<typeof createAdminClient>) {
  const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000).toISOString();

  const { data: stale, error } = await admin
    .from("bookings")
    .select("id, stripe_checkout_session_id")
    .eq("status", "pending")
    .lt("created_at", cutoff);
  if (error) throw new Error(`stale-bookings query failed: ${error.message}`);

  let expired = 0;
  for (const booking of stale ?? []) {
    if (booking.stripe_checkout_session_id) {
      try {
        await stripe.checkout.sessions.expire(booking.stripe_checkout_session_id);
      } catch {
        /* already expired/completed */
      }
    }
    const { error: updError } = await admin
      .from("bookings")
      .update({ status: "payment_failed" })
      .eq("id", booking.id)
      .eq("status", "pending");
    if (!updError) expired += 1;
  }

  return { stale_after_minutes: STALE_AFTER_MINUTES, expired };
}
