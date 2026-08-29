// Verifies a client can cancel an unpaid ("pending") booking and that
// doing so releases the held time slot.
//
//   node scripts/smoke-test-pending-cancel.mjs   (dev server on :3000)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const assert = (c, m) => {
  if (!c) {
    console.error("FAIL:", m);
    process.exit(1);
  }
  console.log("  OK —", m);
};

const suffix = Date.now();
const ids = {
  clientId: null,
  braiderUserId: null,
  braiderProfileId: null,
  serviceId: null,
  a: null,
  b: null,
};
const PW = "correct-horse-battery-staple";

try {
  const { data: c } = await admin.auth.admin.createUser({
    email: `pc-client-${suffix}@braidr.internal.test`,
    password: PW,
    email_confirm: true,
    user_metadata: { role: "client", full_name: "PC Client" },
  });
  const { data: b } = await admin.auth.admin.createUser({
    email: `pc-braider-${suffix}@braidr.internal.test`,
    password: PW,
    email_confirm: true,
    user_metadata: { role: "braider", full_name: "PC Braider" },
  });
  ids.clientId = c.user.id;
  ids.braiderUserId = b.user.id;

  const { data: bp } = await admin
    .from("braider_profiles")
    .insert({ user_id: ids.braiderUserId, city: "London" })
    .select("id")
    .single();
  ids.braiderProfileId = bp.id;
  await admin
    .from("braider_profiles")
    .update({ stripe_account_id: "acct_pc_fake", stripe_charges_enabled: true })
    .eq("id", bp.id);

  const { data: svc } = await admin
    .from("services")
    .insert({
      braider_id: bp.id,
      name: "PC Braids",
      category: "braids",
      price_from: 8000,
      duration_mins: 60,
    })
    .select("id")
    .single();
  ids.serviceId = svc.id;
  console.log("Set up test client + payment-ready braider + service.");

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: c.user.email, password: PW }),
  });
  assert(login.ok, "client login");
  const cookie = (login.headers.get("set-cookie") ?? "")
    .split(/,(?=[^;]+?=[^;]+?)/)
    .map((x) => x.split(";")[0])
    .join("; ");

  const slot = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  const book = (extra = {}) =>
    fetch(`${BASE_URL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        braider_id: bp.id,
        service_id: svc.id,
        appointment_at: slot,
        ...extra,
      }),
    });

  console.log("\n1. Create a pending booking, don't pay");
  const r1 = await book();
  const j1 = await r1.json();
  assert(r1.status === 201, "POST /api/bookings -> 201");
  ids.a = j1.data.booking_id;
  const { data: rowA } = await admin
    .from("bookings")
    .select("status, stripe_checkout_session_id")
    .eq("id", ids.a)
    .single();
  assert(rowA.status === "pending", "booking A is pending");
  assert(
    rowA.stripe_checkout_session_id?.startsWith("cs_"),
    "checkout session id stored on the booking"
  );

  console.log("\n2. The pending booking holds the slot");
  const r2 = await book();
  const j2 = await r2.json();
  assert(
    r2.status === 409 && j2.error?.code === "SLOT_UNAVAILABLE",
    "same slot -> SLOT_UNAVAILABLE while pending"
  );

  console.log("\n3. Cancel the pending booking");
  const rc = await fetch(`${BASE_URL}/api/bookings/${ids.a}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({}),
  });
  const jc = await rc.json();
  assert(rc.status === 200, `cancel -> 200 (got ${rc.status} ${JSON.stringify(jc)})`);
  assert(jc.data.refund_pence === 0, "no refund for an unpaid booking");
  const { data: rowA2 } = await admin.from("bookings").select("status").eq("id", ids.a).single();
  assert(rowA2.status === "cancelled_client", "booking A -> cancelled_client");

  console.log("\n4. The slot is free again");
  const r3 = await book();
  const j3 = await r3.json();
  assert(
    r3.status === 201,
    `re-book the same slot -> 201 (got ${r3.status} ${JSON.stringify(j3)})`
  );
  ids.b = j3.data.booking_id;

  console.log("\nAll checks passed.");
} finally {
  for (const id of [ids.a, ids.b]) if (id) await admin.from("bookings").delete().eq("id", id);
  if (ids.serviceId) await admin.from("services").delete().eq("id", ids.serviceId);
  if (ids.braiderProfileId)
    await admin.from("braider_profiles").delete().eq("id", ids.braiderProfileId);
  for (const id of [ids.clientId, ids.braiderUserId]) if (id) await admin.auth.admin.deleteUser(id);
  console.log("(cleaned up)");
}
