import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { ukTaxYearFor } from "@/lib/bookings/tax-year";
import { fail, ok } from "@/lib/api/response";

// POST /api/stripe/webhook — TRD 4.4 / 9.2. Signature-verified; runs
// entirely on the service-role client since there's no user session on an
// incoming webhook.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set — refusing to process.");
    return fail("INTERNAL_ERROR", "Webhook not configured.", 500);
  }
  if (!signature) return fail("WEBHOOK_SIGNATURE_INVALID", "Missing stripe-signature header.", 400);

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return fail("WEBHOOK_SIGNATURE_INVALID", "Signature verification failed.", 400);
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(admin, event.data.object as Stripe.Checkout.Session);
      break;
    case "payment_intent.payment_failed":
      await handlePaymentFailed(admin, event.data.object as Stripe.PaymentIntent);
      break;
    case "transfer.created":
      await handleTransferCreated(admin, event.data.object as Stripe.Transfer);
      break;
    case "account.updated":
      await handleAccountUpdated(admin, event.data.object as Stripe.Account);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionChange(admin, event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionChange(admin, event.data.object as Stripe.Subscription, true);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(admin, event.data.object as Stripe.Invoice);
      break;
    default:
      break; // acknowledged, not acted on
  }

  return ok({ received: true });
}

// checkout.session.completed covers three distinct payment-mode flows now,
// dispatched by metadata.type — subscription-mode checkouts (BraidCare
// client/braider subscriptions) are handled separately, by
// customer.subscription.created, not here.
async function handleCheckoutCompleted(
  admin: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session
) {
  const type = session.metadata?.type;

  if (type === "braidcare_purchase_oneoff") {
    return handleBraidcareOneoffPurchase(admin, session);
  }
  if (
    type === "braidcare_client_subscription" ||
    type === "braidcare_braider_subscription" ||
    type === "pro_subscription"
  ) {
    // Only persists stripe_customer_id here — the actual subscribed/badge
    // flag is set by customer.subscription.created, which carries the
    // metadata that handler needs and fires around the same time.
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id;
    const userId = session.metadata?.user_id;
    if (customerId && userId) {
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
    }
    return;
  }
  return handleBookingCheckoutCompleted(admin, session);
}

async function handleBookingCheckoutCompleted(
  admin: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session
) {
  // Correlated via metadata.booking_id, not session.payment_intent — see
  // the bookings/route.ts comment on why (payment_intent isn't reliably
  // available at the timing this design originally assumed).
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) {
    console.warn("[stripe webhook] checkout.session.completed with no metadata.booking_id");
    return;
  }

  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, client_id, braider_id, service_id, amount_pence, commission_pence, braider_payout_pence, status"
    )
    .eq("id", bookingId)
    .single();

  if (!booking) {
    console.warn(`[stripe webhook] No booking found for id ${bookingId}`);
    return;
  }
  if (booking.status !== "pending") return; // already processed — webhook retried

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;
  await admin
    .from("bookings")
    .update({ status: "confirmed", stripe_payment_intent_id: paymentIntentId })
    .eq("id", booking.id);

  // NOTE: braidcare_sessions rows are NOT created here. Earlier this
  // handler pre-inserted 3 rows at booking confirmation — that was wrong.
  // bookings.sessions_allocated already defaults to 3 (TRD 3.1.4); THAT is
  // the allocation. Individual braidcare_sessions rows are created one at a
  // time, only when the client actually starts a session (POST
  // /api/braidcare/sessions), with session_number derived from
  // sessions_used at that moment. Fixed once the full BraidCare session
  // flow made the mismatch obvious.

  const [{ data: service }, { data: braiderProfile }] = await Promise.all([
    admin.from("services").select("name").eq("id", booking.service_id).single(),
    admin.from("braider_profiles").select("user_id").eq("id", booking.braider_id).single(),
  ]);

  const now = new Date();
  await admin.from("income_records").insert({
    braider_id: booking.braider_id,
    booking_id: booking.id,
    service_name: service?.name ?? "Service",
    gross_amount_pence: booking.amount_pence,
    commission_pence: booking.commission_pence,
    net_amount_pence: booking.braider_payout_pence,
    tax_year: ukTaxYearFor(now),
    payment_date: now.toISOString().slice(0, 10),
  });

  const [clientUser, braiderUser] = await Promise.all([
    admin.auth.admin.getUserById(booking.client_id),
    braiderProfile ? admin.auth.admin.getUserById(braiderProfile.user_id) : null,
  ]);

  if (clientUser.data?.user?.email) {
    await sendEmail({
      to: clientUser.data.user.email,
      subject: "Your Braidr booking is confirmed",
      text: "Your booking is confirmed and paid. You can view it in your Braidr account.",
    });
  }
  if (braiderUser?.data?.user?.email) {
    await sendEmail({
      to: braiderUser.data.user.email,
      subject: "New Braidr booking",
      text: "You have a new confirmed booking. Check your dashboard for details.",
    });
  }
}

async function handleBraidcareOneoffPurchase(
  admin: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session
) {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) return;
  await admin.rpc("increment_booking_sessions_purchased", { p_booking_id: bookingId });
}

async function handlePaymentFailed(
  admin: ReturnType<typeof createAdminClient>,
  pi: Stripe.PaymentIntent
) {
  // Correlated via metadata.booking_id (set as payment_intent_data.metadata
  // when the Checkout Session was created) — a failed PaymentIntent never
  // reaches checkout.session.completed, so stripe_payment_intent_id on the
  // booking row is still null at this point; metadata is the only link.
  const bookingId = pi.metadata?.booking_id;
  if (!bookingId) return;

  const { data: booking } = await admin
    .from("bookings")
    .select("id, client_id, status")
    .eq("id", bookingId)
    .single();
  if (!booking || booking.status !== "pending") return;

  await admin.from("bookings").update({ status: "payment_failed" }).eq("id", booking.id);

  const { data: clientUser } = await admin.auth.admin.getUserById(booking.client_id);
  if (clientUser?.user?.email) {
    await sendEmail({
      to: clientUser.user.email,
      subject: "Your Braidr payment didn't go through",
      text: "Your card was declined and the booking wasn't completed. Please try again.",
    });
  }
}

async function handleTransferCreated(
  admin: ReturnType<typeof createAdminClient>,
  transfer: Stripe.Transfer
) {
  // Created by /api/cron/release-payouts with metadata.booking_id set —
  // this webhook is a confirmation/reconciliation step, not the trigger.
  const bookingId = transfer.metadata?.booking_id;
  if (!bookingId) return;
  await admin.from("bookings").update({ stripe_transfer_id: transfer.id }).eq("id", bookingId);
}

async function handleAccountUpdated(
  admin: ReturnType<typeof createAdminClient>,
  account: Stripe.Account
) {
  await admin
    .from("braider_profiles")
    .update({ stripe_charges_enabled: account.charges_enabled ?? false })
    .eq("stripe_account_id", account.id);
}

// TRD 9.2's dunning behaviour ("subscription enters grace period 3 days;
// badge remains during grace period") falls out of this for free: Stripe's
// default Smart Retries keep the subscription 'active' or 'past_due' during
// that window and only move it to 'canceled'/'unpaid' after retries are
// exhausted — so treating "active or past_due" as still-subscribed, and
// only clearing it once Stripe itself gives up, matches the TRD's stated
// behaviour without any bespoke grace-period timer here.
const STILL_SUBSCRIBED_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

async function handleSubscriptionChange(
  admin: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription,
  forceInactive = false
) {
  const subscribed = !forceInactive && STILL_SUBSCRIBED_STATUSES.includes(subscription.status);
  const metadata = subscription.metadata;

  if (metadata.subscription_type === "braidcare_client" && metadata.user_id) {
    await admin
      .from("profiles")
      .update({ braidcare_client_subscribed: subscribed })
      .eq("id", metadata.user_id);
  } else if (metadata.subscription_type === "braidcare_braider" && metadata.braider_profile_id) {
    await admin
      .from("braider_profiles")
      .update({ braidcare_subscribed: subscribed, braidcare_badge_active: subscribed })
      .eq("id", metadata.braider_profile_id);
  } else if (metadata.subscription_type === "pro" && metadata.braider_profile_id) {
    // stripe_pro_subscription_id is stored (not just the boolean) because
    // DELETE /api/pro/subscribe needs it to call stripe.subscriptions.update
    // — see that route and the migration note on why this column exists.
    await admin
      .from("braider_profiles")
      .update({
        braidr_pro_subscribed: subscribed,
        stripe_pro_subscription_id: subscribed ? subscription.id : null,
      })
      .eq("id", metadata.braider_profile_id);
  }
}

async function handleInvoicePaymentFailed(
  admin: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();
  const userId = profile?.id;
  if (!userId) return;

  const { data: user } = await admin.auth.admin.getUserById(userId);
  if (user?.user?.email) {
    await sendEmail({
      to: user.user.email,
      subject: "Your Braidr subscription payment failed",
      text: "We couldn't process your latest subscription payment. Please update your payment method to avoid losing access.",
    });
  }
}
