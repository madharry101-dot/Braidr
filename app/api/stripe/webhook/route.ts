import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { ukTaxYearFor } from "@/lib/bookings/tax-year";
import { fail, ok } from "@/lib/api/response";

// POST /api/stripe/webhook — TRD 4.4 / 9.2. Signature-verified; runs
// entirely on the service-role client since there's no user session on an
// incoming webhook.
//
// Signature verification below is UNCHANGED and deliberately untouched.
//
// How long one delivery may hold an event before another may reclaim it.
// Comfortably longer than any handler here, and shorter than Stripe's retry
// backoff, so a genuinely dead attempt is picked up by the next delivery
// rather than blocking the event forever.
const LEASE_SECONDS = 60;

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

  // R-06 — claim this event before doing anything with it.
  //
  // Stripe retries any delivery that does not get a 2xx, and can deliver the
  // same event more than once even after a success. Nothing used to record
  // event.id, so a replay re-ran the handler and re-sent notification email.
  //
  // The claim is a LEASE, not a "seen" marker. An event is only recorded as
  // processed once the handler has actually returned — see the migration
  // comment for why insert-first dedup silently loses events.
  const { data: claim, error: claimError } = await admin.rpc("claim_stripe_webhook_event", {
    p_event_id: event.id,
    p_type: event.type,
    p_lease_seconds: LEASE_SECONDS,
  });

  if (claimError) {
    // Could not even record the attempt. Do NOT process: without the ledger
    // there is nothing stopping a retry from doing it all again.
    console.error("[stripe webhook] could not claim event", event.id, claimError);
    return fail("INTERNAL_ERROR", "Could not record event.", 500);
  }

  if (claim === "already_processed") {
    return ok({ received: true, duplicate: true });
  }

  if (claim === "in_flight") {
    // Another delivery holds the lease. Answering 200 here would tell Stripe
    // the event is handled while the work may still fail, so this is
    // deliberately non-2xx: Stripe backs off and tries again.
    console.warn("[stripe webhook] event already in flight, asking Stripe to retry", event.id);
    return fail("WEBHOOK_EVENT_IN_FLIGHT", "Event is already being processed.", 409);
  }

  try {
    await dispatch(admin, event);
  } catch (e) {
    // Release the lease so the next retry can pick it up, then fail loudly.
    // If this release itself fails the lease still ages out, which is the
    // whole reason it is a lease.
    console.error("[stripe webhook] handler threw for", event.type, event.id, e);
    const { error: releaseError } = await admin.rpc("release_stripe_webhook_event", {
      p_event_id: event.id,
    });
    if (releaseError) {
      console.error("[stripe webhook] could not release lease for", event.id, releaseError);
    }
    return fail("INTERNAL_ERROR", "Handler failed.", 500);
  }

  const { error: completeError } = await admin.rpc("complete_stripe_webhook_event", {
    p_event_id: event.id,
  });
  if (completeError) {
    // The work is done but the ledger does not know. Returning 500 would make
    // Stripe retry work that already happened; the lease will expire and a
    // retry would redo it anyway, so say so loudly and acknowledge.
    console.error(
      "[stripe webhook] processed but could not mark complete",
      event.id,
      completeError
    );
  }

  return ok({ received: true });
}

// Every branch here must THROW on failure rather than swallowing. A silent
// return would be recorded as a successful delivery and Stripe would never
// send the event again.
async function dispatch(admin: ReturnType<typeof createAdminClient>, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(admin, event.data.object as Stripe.Checkout.Session);
      break;
    case "checkout.session.expired":
      await handleCheckoutExpired(admin, event.data.object as Stripe.Checkout.Session);
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
    case "customer.subscription.deleted":
      await handleSubscriptionChange(
        admin,
        event.data.object as Stripe.Subscription,
        event.type === "customer.subscription.deleted"
      );
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(admin, event.data.object as Stripe.Invoice);
      break;
    default:
      break; // acknowledged, not acted on
  }
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
  const { error: incomeError } = await admin.from("income_records").insert({
    braider_id: booking.braider_id,
    booking_id: booking.id,
    service_name: service?.name ?? "Service",
    gross_amount_pence: booking.amount_pence,
    commission_pence: booking.commission_pence,
    net_amount_pence: booking.braider_payout_pence,
    tax_year: ukTaxYearFor(now),
    payment_date: now.toISOString().slice(0, 10),
  });
  if (incomeError) {
    // R-06. UNIQUE(booking_id) is what actually stopped a replayed event
    // double-counting a braider's taxable income — this insert simply used to
    // ignore its own error, so it worked by accident. 23505 is the expected
    // outcome of a replay and is fine. Anything else is a real failure and
    // must throw, so the route releases the lease and Stripe retries; a
    // swallowed error here would mean a confirmed booking with no income
    // record and nothing anywhere saying so.
    if (incomeError.code === "23505") {
      console.info(
        "[stripe webhook] income record already exists for booking",
        booking.id,
        "- replayed event, ignoring."
      );
    } else {
      throw new Error(`income_records insert failed: ${incomeError.message}`);
    }
  }

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

// checkout.session.expired — the client opened checkout for a booking and
// never paid (abandoned, or the 30-minute session lapsed). Release the
// pending booking so its time slot frees up. -> payment_failed rather than
// cancelled_* because no one deliberately cancelled it; the /bookings/
// confirmed page and status badge already handle this state.
async function handleCheckoutExpired(
  admin: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session
) {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId || session.metadata?.type !== "booking") return;
  await admin
    .from("bookings")
    .update({ status: "payment_failed" })
    .eq("id", bookingId)
    .eq("status", "pending");
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

// R-06 — read the CURRENT object from Stripe instead of trusting the event.
//
// Stripe does not guarantee delivery order. Applying the payload of whichever
// event happens to arrive last can revert state: an older account.updated
// landing after a newer one would put back a stale charges_enabled, and an
// older subscription.updated landing after a cancellation would restore paid
// access. Fetching sidesteps the ordering question entirely, because the
// answer is whatever Stripe says right now.
//
// Returns null ONLY for a 404, which means the object is not there to read —
// a wrong API mode or a bad id. That is terminal: retrying cannot fix it, so
// it is logged at error level and acknowledged. Every other failure throws,
// so the lease is released and the delivery is retried. It must never fall
// back to the event payload; that would reintroduce exactly the staleness
// this exists to remove.
async function retrieveCurrent<T>(
  fetchCurrent: () => Promise<T>,
  label: string
): Promise<T | null> {
  try {
    return await fetchCurrent();
  } catch (e) {
    const statusCode =
      typeof e === "object" && e !== null && "statusCode" in e
        ? (e as { statusCode?: number }).statusCode
        : undefined;
    if (statusCode === 404) {
      console.error(
        `[stripe webhook] ${label} does not exist at Stripe (404) - acknowledging without applying. Wrong API mode, or the id is not ours.`
      );
      return null;
    }
    throw e;
  }
}

async function handleAccountUpdated(
  admin: ReturnType<typeof createAdminClient>,
  account: Stripe.Account
) {
  const current = await retrieveCurrent(
    () => stripe.accounts.retrieve(account.id),
    `account ${account.id}`
  );
  if (!current) return;

  const { error } = await admin
    .from("braider_profiles")
    .update({ stripe_charges_enabled: current.charges_enabled ?? false })
    .eq("stripe_account_id", current.id);
  if (error) throw new Error(`braider_profiles charges_enabled update failed: ${error.message}`);
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
  isDeletion = false
) {
  // R-06 — see retrieveCurrent(). The event payload is a snapshot of when the
  // event was created, which is not necessarily now.
  const fresh = await retrieveCurrent(
    () => stripe.subscriptions.retrieve(subscription.id),
    `subscription ${subscription.id}`
  );

  // A deletion still has to be applied even if the object cannot be read:
  // "this subscription is gone" is true regardless, and skipping it would
  // leave someone subscribed forever. For any other event a 404 means we have
  // nothing trustworthy to apply, and retrieveCurrent has already logged it.
  if (!fresh && !isDeletion) return;
  const current = fresh ?? subscription;

  // `isDeletion` is belt and braces: a fetched deleted subscription comes back
  // 'canceled', which is already not in STILL_SUBSCRIBED_STATUSES. It stays so
  // that a deletion event can never, by any route, end in subscribed = true.
  const subscribed = !isDeletion && STILL_SUBSCRIBED_STATUSES.includes(current.status);
  const metadata = current.metadata;

  if (metadata.subscription_type === "braidcare_client" && metadata.user_id) {
    // Source of truth is braidcare_subscriptions (TRD v2.0 §3.3); the
    // profiles boolean is kept in sync for the reads that still use it.
    const status = isDeletion
      ? "cancelled"
      : current.status === "past_due"
        ? "past_due"
        : subscribed
          ? "active"
          : "cancelled";
    // current_period_end moved to the subscription item in recent Stripe
    // API versions; fall back to +30 days if somehow absent.
    const periodEndUnix =
      current.items.data[0]?.current_period_end ?? Math.floor(Date.now() / 1000) + 2_592_000;
    await admin.from("braidcare_subscriptions").upsert(
      {
        user_id: metadata.user_id,
        role: "client",
        stripe_subscription_id: current.id,
        status,
        price_pence: 799,
        current_period_end: new Date(periodEndUnix * 1000).toISOString(),
      },
      { onConflict: "user_id" }
    );
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
        stripe_pro_subscription_id: subscribed ? current.id : null,
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
