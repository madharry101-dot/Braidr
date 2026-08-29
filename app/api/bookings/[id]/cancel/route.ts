import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { cancelBookingSchema } from "@/lib/validations/booking";
import { ok, fail } from "@/lib/api/response";
import { stripe } from "@/lib/stripe/client";

// POST /api/bookings/:id/cancel
//
// - pending (checkout never completed): cancel it and expire the Stripe
//   Checkout Session so it can't be paid after the fact. No refund — no
//   money was taken. This also frees the held time slot.
// - confirmed (paid): TRD 9.1 refund policy — 48h+ notice = full refund;
//   24-48h = 50%; under 24h = none. Money sits in the platform's own Stripe
//   balance (separate charges and transfers), so this is a plain
//   stripe.refunds.create against the PaymentIntent; no transfer has
//   happened yet, so nothing to claw back from the braider.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(cancelBookingSchema, await request.json().catch(() => ({})));
  if (!parsed.ok) return parsed.response;

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, client_id, braider_id, status, appointment_at, amount_pence, stripe_payment_intent_id, stripe_checkout_session_id"
    )
    .eq("id", params.id)
    .single();

  if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
  if (booking.status !== "confirmed" && booking.status !== "pending") {
    return fail("BOOKING_NOT_CONFIRMED", "This booking can no longer be cancelled.", 409);
  }

  const isClient = user.id === booking.client_id;
  const admin = createAdminClient();

  // Unpaid booking: expire the checkout session, drop the row to cancelled.
  if (booking.status === "pending") {
    if (booking.stripe_checkout_session_id) {
      try {
        await stripe.checkout.sessions.expire(booking.stripe_checkout_session_id);
      } catch {
        // Already expired/completed — the webhook's status guard covers the
        // completed case; nothing else to do.
      }
    }
    const { error } = await admin
      .from("bookings")
      .update({
        status: isClient ? "cancelled_client" : "cancelled_braider",
        cancellation_reason: parsed.data.reason ?? "Payment not completed",
      })
      .eq("id", params.id)
      .eq("status", "pending"); // no-op if it was paid in the meantime
    if (error) return fail("INTERNAL_ERROR", "Failed to cancel booking.", 500);
    return ok({ cancelled: true, refund_pence: 0 });
  }

  // Confirmed booking: apply the refund policy.
  const hoursUntilAppointment =
    (new Date(booking.appointment_at).getTime() - Date.now()) / (60 * 60 * 1000);

  let refundPence = 0;
  if (hoursUntilAppointment >= 48) refundPence = booking.amount_pence;
  else if (hoursUntilAppointment >= 24) refundPence = Math.round(booking.amount_pence / 2);

  if (refundPence > 0) {
    if (!booking.stripe_payment_intent_id) {
      return fail("INTERNAL_ERROR", "This booking has no payment on record — cannot refund.", 500);
    }
    await stripe.refunds.create(
      { payment_intent: booking.stripe_payment_intent_id, amount: refundPence },
      { idempotencyKey: `refund-${booking.id}` }
    );
  }

  const { error } = await admin
    .from("bookings")
    .update({
      status: isClient ? "cancelled_client" : "cancelled_braider",
      cancellation_reason: parsed.data.reason ?? null,
    })
    .eq("id", params.id);
  if (error) return fail("INTERNAL_ERROR", "Failed to cancel booking.", 500);

  return ok({ cancelled: true, refund_pence: refundPence });
}
