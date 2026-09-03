// Smoke test: BraidCare client subscription (plan §1.1a).
// Signs a synthetic customer.subscription.created event and POSTs it to the
// local /api/stripe/webhook, then checks a braidcare_subscriptions row and
// the profiles.braidcare_client_subscribed mirror. Cleans up after itself.
//
//   node scripts/smoke-test-braidcare-subscription.mjs
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createTeardown, finishTeardown } from "./lib/smoketest.mjs";
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

const assert = (cond, msg) => {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("  OK —", msg);
};

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const client = list.users.find((u) => u.email === "demo-client@demo.braidr");
assert(client, "found demo-client@demo.braidr");
const userId = client.id;
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
  // This script is the one exception to marker-based cleanup, and the reason
  // is worth stating plainly: it creates NO user of its own. It operates on
  // the seeded demo-client@demo.braidr account, which is PROTECTED - discovery
  // will never return it, and must not, or a reaper would eat the demo
  // marketplace.
  //
  // So its artefacts have to be named explicitly. If this ever fails silently,
  // a real seeded account is left permanently flagged as a paying BraidCare
  // subscriber. finishTeardown still runs, to surface a failure loudly and to
  // catch anything a future edit introduces.
  //
  // The proper fix is to give this script its own fixture user. Flagged rather
  // than worked around.
  console.log("\nCleaning up...");
  const teardown = createTeardown();
  teardown.step("braidcare_subscriptions", () =>
    admin.from("braidcare_subscriptions").delete().eq("user_id", userId)
  );
  teardown.step("profiles.braidcare_client_subscribed reset", () =>
    admin.from("profiles").update({ braidcare_client_subscribed: false }).eq("id", userId)
  );
  await finishTeardown(admin, await teardown.run());
}
