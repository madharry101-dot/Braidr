// Smoke test: BraidCare client subscription (plan §1.1a).
// Signs a synthetic customer.subscription.created event and POSTs it to the
// local /api/stripe/webhook, then checks a braidcare_subscriptions row and
// the profiles.braidcare_client_subscribed mirror. Cleans up after itself.
//
//   node scripts/smoke-test-braidcare-subscription.mjs
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { finishTeardown, smoketestEmail } from "./lib/smoketest.mjs";
import WebSocket from "ws";

globalThis.WebSocket ??= WebSocket;

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    })
);

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Throws rather than calling process.exit(). process.exit() terminates
// immediately and does NOT run finally blocks, so an assertion failure used to
// skip teardown altogether — the one circumstance in which cleanup matters
// most. Throwing lets the finally block run and the fixture get reaped.
const assert = (cond, msg) => {
  if (!cond) throw new Error("ASSERTION FAILED: " + msg);
  console.log("  OK —", msg);
};

// Its own marked fixture, NOT the seeded demo-client@demo.braidr account.
//
// This script used to find that seeded account and mutate it — insert a
// braidcare_subscriptions row and set profiles.braidcare_client_subscribed.
// Two things were wrong with that. A silent teardown failure left a real,
// permanent demo account flagged as a paying subscriber; and the artefacts
// carried no marker, so reap-smoketest-data.mjs could not find them and must
// not be made to guess, because guessing at unmarked data means reaching into
// @demo.braidr, which is PROTECTED.
//
// Nothing here ever needed that specific account: the webhook handler only
// reads metadata.user_id, so any user with a profiles row exercises the same
// path. role: "client" so handle_new_user() creates the profile the handler
// then updates.
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email: smoketestEmail("braidcare-sub"),
  password: "correct-horse-battery-staple",
  email_confirm: true,
  user_metadata: { role: "client", full_name: "BraidCare Subscription Smoke Test Client" },
});
if (createError) throw new Error("could not create fixture user: " + createError.message);
const userId = created.user.id;
console.log("Fixture client:", created.user.email);
const subId = `sub_smoke_${Date.now()}`;

async function fireSubscriptionEvent(type, status) {
  const payload = JSON.stringify({
    id: `evt_${Date.now()}`,
    type,
    data: {
      object: {
        id: subId,
        object: "subscription",
        status,
        metadata: { subscription_type: "braidcare_client", user_id: userId },
        items: {
          data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }],
        },
      },
    },
  });
  const sig = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: env.STRIPE_WEBHOOK_SECRET,
  });
  const res = await fetch(`${BASE_URL}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": sig },
    body: payload,
  });
  assert(res.status === 200, `${type} (${status}) accepted -> 200 (got ${res.status})`);
}

try {
  console.log("\n1. customer.subscription.created (active)");
  await fireSubscriptionEvent("customer.subscription.created", "active");

  const { data: sub } = await admin
    .from("braidcare_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();
  assert(sub, "braidcare_subscriptions row created");
  assert(sub.status === "active", `status = active (got ${sub.status})`);
  assert(sub.price_pence === 799, `price_pence = 799 (got ${sub.price_pence})`);
  assert(sub.stripe_subscription_id === subId, "stripe_subscription_id stored");
  assert(new Date(sub.current_period_end) > new Date(), "current_period_end in the future");

  const { data: prof } = await admin
    .from("profiles")
    .select("braidcare_client_subscribed")
    .eq("id", userId)
    .single();
  assert(prof.braidcare_client_subscribed === true, "profiles mirror flag = true");

  console.log("\n2. customer.subscription.deleted -> cancelled");
  await fireSubscriptionEvent("customer.subscription.deleted", "canceled");
  const { data: sub2 } = await admin
    .from("braidcare_subscriptions")
    .select("status")
    .eq("user_id", userId)
    .single();
  assert(sub2.status === "cancelled", `status = cancelled (got ${sub2.status})`);

  console.log("\nAll checks passed.");
} finally {
  // Standard marker-based cleanup now that the fixture is marked. No explicit
  // steps are needed: braidcare_subscriptions.user_id references profiles(id)
  // ON DELETE CASCADE, profiles cascade from auth.users, and discovery also
  // lists braidcare_subscriptions in USER_SCOPED_TABLES — so the row goes
  // three different ways and finishTeardown verifies it actually did.
  console.log("\nCleaning up...");
  await finishTeardown(admin);
}
