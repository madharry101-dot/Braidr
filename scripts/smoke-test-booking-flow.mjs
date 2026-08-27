// One-off verification script — not part of the app. Exercises the real
// booking + Stripe Checkout + webhook flow end-to-end:
//   1. Creates a test client + braider (admin API, no email needed)
//   2. Creates a braider_profiles + services row
//   3. Logs in as the client via the real /api/auth/login route (real cookie)
//   4. Creates a real booking via POST /api/bookings (real Stripe Checkout
//      Session in test mode)
//   5. Synthesises a correctly-signed checkout.session.completed event
//      (Stripe's documented way to test webhooks without a browser) and
//      POSTs it to /api/stripe/webhook
//   6. Verifies: booking flipped to 'confirmed', 3 braidcare_sessions
//      allocated, 1 income_records row written
//   7. Cleans up every row it created, in FK-safe order
//
// Requires the dev server running on localhost:3000 and Stripe CLI forwarding
// NOT required for this script itself (it signs its own webhook event).
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import WebSocket from "ws";

globalThis.WebSocket = WebSocket;

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const BASE_URL = "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });

const ids = {
  clientId: null,
  braiderUserId: null,
  braiderProfileId: null,
  serviceId: null,
  bookingId: null,
};

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

try {
  console.log("1. Creating test client + braider users...");
  const suffix = Date.now();
  const { data: clientUser } = await admin.auth.admin.createUser({
    email: `smoketest-client-${suffix}@braidr.internal.test`,
    password: "correct-horse-battery-staple",
    email_confirm: true,
    user_metadata: { role: "client", full_name: "Smoke Test Client" },
  });
  const { data: braiderUser } = await admin.auth.admin.createUser({
    email: `smoketest-braider-${suffix}@braidr.internal.test`,
    password: "correct-horse-battery-staple",
    email_confirm: true,
    user_metadata: { role: "braider", full_name: "Smoke Test Braider" },
  });
  ids.clientId = clientUser.user.id;
  ids.braiderUserId = braiderUser.user.id;
  console.log("   OK — client:", ids.clientId, "braider:", ids.braiderUserId);

  console.log("2. Creating braider_profiles (payment-ready) + a service...");
  const { data: braiderProfile, error: bpError } = await admin
    .from("braider_profiles")
    .insert({ user_id: ids.braiderUserId, city: "London" })
    .select("id")
    .single();
  if (bpError) throw bpError;
  ids.braiderProfileId = braiderProfile.id;

  // Bypassing real Stripe Connect onboarding for this test — that code path
  // (POST /api/braiders/:id/stripe/onboard) is straightforward and already
  // typechecked; what needs a real end-to-end test is the booking/webhook
  // flow, which only needs these two fields to be truthy to pass the
  // BRAIDER_NOT_PAYMENT_READY gate.
  await admin
    .from("braider_profiles")
    .update({ stripe_account_id: "acct_smoketest_fake", stripe_charges_enabled: true })
    .eq("id", ids.braiderProfileId);

  const { data: service, error: svcError } = await admin
    .from("services")
    .insert({
      braider_id: ids.braiderProfileId,
      name: "Smoke Test Knotless Braids",
      category: "braids",
      price_from: 8000,
      duration_mins: 60,
    })
    .select("id")
    .single();
  if (svcError) throw svcError;
  ids.serviceId = service.id;
  console.log("   OK — braider_profile:", ids.braiderProfileId, "service:", ids.serviceId);

  console.log("3. Logging in as the client via the real API route...");
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: clientUser.user.email,
      password: "correct-horse-battery-staple",
    }),
  });
  const setCookieHeader = loginRes.headers.get("set-cookie");
  assert(loginRes.ok, `login failed: ${loginRes.status} ${await loginRes.text()}`);
  assert(setCookieHeader, "login did not return a session cookie");
  // Node's fetch collapses multiple Set-Cookie headers into one string
  // joined by ", " in some runtimes; split defensively and keep name=value.
  const cookieHeader = setCookieHeader
    .split(/,(?=[^;]+?=[^;]+?)/)
    .map((c) => c.split(";")[0])
    .join("; ");
  console.log("   OK — session cookie captured");

  console.log(
    "4. Creating a real booking via POST /api/bookings (real Stripe test Checkout Session)..."
  );
  const appointmentAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const bookingRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({
      braider_id: ids.braiderProfileId,
      service_id: ids.serviceId,
      appointment_at: appointmentAt,
    }),
  });
  const bookingBody = await bookingRes.json();
  assert(bookingRes.status === 201, `booking creation failed: ${JSON.stringify(bookingBody)}`);
  ids.bookingId = bookingBody.data.booking_id;
  console.log("   OK — booking_id:", ids.bookingId, "checkout_url:", bookingBody.data.checkout_url);

  const { data: pendingBooking } = await admin
    .from("bookings")
    .select(
      "status, stripe_payment_intent_id, amount_pence, commission_pence, braider_payout_pence"
    )
    .eq("id", ids.bookingId)
    .single();
  assert(pendingBooking.status === "pending", "booking should start as pending");
  assert(
    pendingBooking.stripe_payment_intent_id === null,
    "payment_intent should still be null pre-webhook"
  );
  assert(pendingBooking.amount_pence === 8000, "amount_pence should equal service.price_from");
  assert(pendingBooking.commission_pence === 960, "commission should be 12% (not Pro yet)");
  console.log(
    "   OK — pending row correct: 8000 / 960 commission / payment_intent correctly still null"
  );

  console.log(
    "5. Synthesising a signed checkout.session.completed event (correlated via metadata.booking_id)..."
  );
  const fakePaymentIntentId = `pi_smoketest_${suffix}`;
  const eventPayload = JSON.stringify({
    id: `evt_smoketest_${suffix}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_smoketest_${suffix}`,
        object: "checkout.session",
        payment_intent: fakePaymentIntentId,
        metadata: { booking_id: ids.bookingId },
      },
    },
  });
  const signedHeader = stripe.webhooks.generateTestHeaderString({
    payload: eventPayload,
    secret: env.STRIPE_WEBHOOK_SECRET,
  });

  const webhookRes = await fetch(`${BASE_URL}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": signedHeader },
    body: eventPayload,
  });
  assert(
    webhookRes.status === 200,
    `webhook rejected: ${webhookRes.status} ${await webhookRes.text()}`
  );
  console.log(
    "   OK — webhook accepted (signature verified against your real STRIPE_WEBHOOK_SECRET)"
  );

  console.log("6. Verifying side effects...");
  const { data: confirmedBooking } = await admin
    .from("bookings")
    .select("status, stripe_payment_intent_id")
    .eq("id", ids.bookingId)
    .single();
  assert(
    confirmedBooking.status === "confirmed",
    `expected confirmed, got ${confirmedBooking.status}`
  );
  assert(
    confirmedBooking.stripe_payment_intent_id === fakePaymentIntentId,
    "stripe_payment_intent_id should now be set from the webhook payload"
  );
  console.log("   OK — booking status -> confirmed, payment_intent_id captured from webhook");

  const { data: sessions } = await admin
    .from("braidcare_sessions")
    .select("session_number, session_type, status")
    .eq("booking_id", ids.bookingId)
    .order("session_number");
  assert(sessions.length === 3, `expected 3 braidcare sessions, got ${sessions.length}`);
  assert(
    sessions.every((s) => s.session_type === "included"),
    "all 3 should be type 'included'"
  );
  console.log("   OK — 3 BraidCare sessions allocated");

  const { data: incomeRecords } = await admin
    .from("income_records")
    .select("gross_amount_pence, commission_pence, net_amount_pence, tax_year")
    .eq("booking_id", ids.bookingId);
  assert(incomeRecords.length === 1, `expected 1 income record, got ${incomeRecords.length}`);
  assert(incomeRecords[0].net_amount_pence === 7040, "net should be 8000 - 960");
  console.log("   OK — income record written:", JSON.stringify(incomeRecords[0]));

  console.log("\nAll checks passed — booking + Stripe Checkout + webhook flow works end-to-end.");
} finally {
  console.log("\nCleaning up (FK-safe order)...");
  if (ids.bookingId) {
    await admin.from("income_records").delete().eq("booking_id", ids.bookingId);
    await admin.from("braidcare_sessions").delete().eq("booking_id", ids.bookingId);
    await admin.from("bookings").delete().eq("id", ids.bookingId);
  }
  if (ids.serviceId) await admin.from("services").delete().eq("id", ids.serviceId);
  if (ids.braiderProfileId)
    await admin.from("braider_profiles").delete().eq("id", ids.braiderProfileId);
  if (ids.clientId) await admin.auth.admin.deleteUser(ids.clientId);
  if (ids.braiderUserId) await admin.auth.admin.deleteUser(ids.braiderUserId);
  console.log("Done.");
}
