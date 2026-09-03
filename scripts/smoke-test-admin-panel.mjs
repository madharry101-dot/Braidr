// One-off verification script — not part of the app. Exercises the Admin
// Panel end-to-end against the live Supabase project and real Stripe test
// mode:
//   1. User management: list, suspend (login correctly blocked, then
//      restored), hard-delete a user with no history, anonymise a user
//      WITH booking history (booking row survives, login disabled)
//   2. Braider verification queue + approve
//   3. Dispute flow on a REAL Stripe PaymentIntent: raise -> dismiss
//      (status restored) -> raise again -> resolve with a REAL refund,
//      including the transfer-reversal attempt path
//   4. Platform report sanity check
//   5. Cleans up every row, user, and Stripe object it created
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { finishTeardown } from "./lib/smoketest.mjs";
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

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" });

const ids = {
  adminUserId: null,
  clientNoHistoryId: null,
  clientWithHistoryId: null,
  braiderUserId: null,
  braiderProfileId: null,
  serviceId: null,
  bookingId: null,
  paymentIntentId: null,
};

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}
function updateJarFromResponse(jar, res) {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return;
  for (const part of setCookie.split(/,(?=[^;]+?=[^;]+?)/)) {
    const [nv] = part.split(";");
    const eq = nv.indexOf("=");
    if (eq === -1) continue;
    jar.set(nv.slice(0, eq).trim(), nv.slice(eq + 1).trim());
  }
}
function jarHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
async function authedFetch(jar, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...options.headers, Cookie: jarHeader(jar) },
  });
  updateJarFromResponse(jar, res);
  return res;
}
async function login(email, password) {
  const jar = new Map();
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  updateJarFromResponse(jar, res);
  return { jar, res };
}

const PASSWORD = "correct-horse-battery-staple";

try {
  const suffix = Date.now();
  const makeUser = async (label, role) => {
    const { data } = await admin.auth.admin.createUser({
      email: `smoketest-admin-${label}-${suffix}@braidr.internal.test`,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role, full_name: `Admin Smoke Test ${label}` },
    });
    return data.user;
  };

  console.log("1. Creating test users (admin, two clients, a braider)...");
  const adminUser = await makeUser("admin", "client");
  await admin.from("profiles").update({ role: "admin" }).eq("id", adminUser.id);
  const clientNoHistory = await makeUser("no-history", "client");
  const clientWithHistory = await makeUser("with-history", "client");
  const braiderUser = await makeUser("braider", "braider");
  ids.adminUserId = adminUser.id;
  ids.clientNoHistoryId = clientNoHistory.id;
  ids.clientWithHistoryId = clientWithHistory.id;
  ids.braiderUserId = braiderUser.id;
  const { data: braiderProfile } = await admin
    .from("braider_profiles")
    // is_active: false so a stranded profile cannot reach the public
    // directory. braider_profiles.is_active defaults to TRUE, and on
    // 2026-08-31 a failed teardown left one listed publicly for three days.
    // Nothing in this script reads the braider as another user or through
    // public_profiles, so hiding it costs the test nothing.
    .insert({ user_id: ids.braiderUserId, city: "London", is_active: false })
    .select("id")
    .single();
  ids.braiderProfileId = braiderProfile.id;
  const adminJar = (await login(adminUser.email, PASSWORD)).jar;
  console.log("   OK");

  console.log("2. GET /api/admin/users lists them...");
  const listRes = await authedFetch(
    adminJar,
    `${BASE_URL}/api/admin/users?search=Admin Smoke Test`
  );
  const listBody = await listRes.json();
  assert(listRes.status === 200, `list failed: ${JSON.stringify(listBody)}`);
  assert(listBody.data.users.length >= 4, "should list at least the 4 test users");
  console.log("   OK —", listBody.data.users.length, "users found");

  console.log("3. Suspending clientWithHistory blocks login, unsuspending restores it...");
  const suspendRes = await authedFetch(
    adminJar,
    `${BASE_URL}/api/admin/users/${ids.clientWithHistoryId}/suspend`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: true }),
    }
  );
  assert(suspendRes.status === 200, `suspend failed: ${JSON.stringify(await suspendRes.json())}`);
  const blockedLogin = await login(clientWithHistory.email, PASSWORD);
  assert(
    blockedLogin.res.status === 403,
    `expected login blocked (403), got ${blockedLogin.res.status}`
  );
  await authedFetch(adminJar, `${BASE_URL}/api/admin/users/${ids.clientWithHistoryId}/suspend`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suspended: false }),
  });
  const restoredLogin = await login(clientWithHistory.email, PASSWORD);
  assert(
    restoredLogin.res.status === 200,
    `expected login restored, got ${restoredLogin.res.status}`
  );
  console.log("   OK — suspend blocks login, unsuspend restores it");

  console.log("4. Deleting a user with NO history -> real hard delete...");
  const deleteNoHistoryRes = await authedFetch(
    adminJar,
    `${BASE_URL}/api/admin/users/${ids.clientNoHistoryId}`,
    {
      method: "DELETE",
    }
  );
  const deleteNoHistoryBody = await deleteNoHistoryRes.json();
  assert(
    deleteNoHistoryRes.status === 200,
    `delete failed: ${JSON.stringify(deleteNoHistoryBody)}`
  );
  assert(
    deleteNoHistoryBody.data.mode === "deleted",
    `expected mode 'deleted', got ${deleteNoHistoryBody.data.mode}`
  );
  const { data: goneUser } = await admin.auth.admin.getUserById(ids.clientNoHistoryId);
  assert(!goneUser?.user, "user should no longer exist in auth.users");
  ids.clientNoHistoryId = null; // already gone, skip in cleanup
  console.log("   OK — hard deleted");

  console.log(
    "5. Giving clientWithHistory a real booking, then deleting -> anonymise, not delete..."
  );
  const { data: service } = await admin
    .from("services")
    .insert({
      braider_id: ids.braiderProfileId,
      name: "Admin Smoke Test Service",
      category: "braids",
      price_from: 8000,
      duration_mins: 60,
    })
    .select("id")
    .single();
  ids.serviceId = service.id;

  const pi = await stripe.paymentIntents.create({
    amount: 8000,
    currency: "gbp",
    payment_method: "pm_card_visa",
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
  });
  ids.paymentIntentId = pi.id;
  assert(pi.status === "succeeded", `expected PaymentIntent to succeed, got ${pi.status}`);

  const { data: booking } = await admin
    .from("bookings")
    .insert({
      client_id: ids.clientWithHistoryId,
      braider_id: ids.braiderProfileId,
      service_id: ids.serviceId,
      appointment_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      amount_pence: 8000,
      commission_pence: 960,
      braider_payout_pence: 7040,
      status: "confirmed",
      stripe_payment_intent_id: ids.paymentIntentId,
    })
    .select("id")
    .single();
  ids.bookingId = booking.id;

  const deleteWithHistoryRes = await authedFetch(
    adminJar,
    `${BASE_URL}/api/admin/users/${ids.clientWithHistoryId}`,
    {
      method: "DELETE",
    }
  );
  const deleteWithHistoryBody = await deleteWithHistoryRes.json();
  assert(
    deleteWithHistoryRes.status === 200,
    `delete failed: ${JSON.stringify(deleteWithHistoryBody)}`
  );
  assert(
    deleteWithHistoryBody.data.mode === "anonymised",
    `expected 'anonymised', got ${deleteWithHistoryBody.data.mode}`
  );
  const { data: anonProfile } = await admin
    .from("profiles")
    .select("full_name, is_suspended")
    .eq("id", ids.clientWithHistoryId)
    .single();
  assert(anonProfile.full_name === "Deleted User", "profile should be anonymised");
  assert(anonProfile.is_suspended === true, "anonymised profile should also be suspended");
  const { data: survivingBooking } = await admin
    .from("bookings")
    .select("id")
    .eq("id", ids.bookingId)
    .single();
  assert(survivingBooking, "the booking row must survive — HMRC 7-year retention");
  console.log("   OK — anonymised, login disabled, booking record preserved");

  console.log("6. Braider verification queue + approve...");
  const pendingRes = await authedFetch(adminJar, `${BASE_URL}/api/admin/braiders/pending`);
  const pendingBody = await pendingRes.json();
  assert(
    pendingBody.data.pending.some((b) => b.id === ids.braiderProfileId),
    "braider should be in the pending queue"
  );
  const verifyRes = await authedFetch(
    adminJar,
    `${BASE_URL}/api/admin/braiders/${ids.braiderProfileId}/verify`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true, note: "Looks legit." }),
    }
  );
  assert(verifyRes.status === 200, `verify failed: ${JSON.stringify(await verifyRes.json())}`);
  const { data: verifiedBraider } = await admin
    .from("braider_profiles")
    .select("is_verified, is_active")
    .eq("id", ids.braiderProfileId)
    .single();
  assert(verifiedBraider.is_verified === true, "braider should now be verified");
  // Asserting false rather than true is deliberate and is a stronger check.
  // The profile is created is_active: false (see the insert above), so this
  // now proves verification does not flip a braider INTO the public directory
  // — which is the direction that actually matters. The old assertion of
  // `=== true` would have passed even if the verify route set is_active: true
  // explicitly, because the row already started that way.
  assert(
    verifiedBraider.is_active === false,
    "verification must not change is_active — a rejected or newly verified braider must not be auto-listed"
  );
  console.log("   OK");

  console.log("7. Dispute flow: raise -> dismiss (status restored)...");
  // Booking's client was anonymised/suspended above but the row itself is
  // untouched — raising a dispute doesn't require the client to still be
  // able to log in, so we do it via the admin/service-role client directly
  // rather than trying to log that user back in.
  const disputeRes1 = await admin
    .from("bookings")
    .update({
      status: "disputed",
      pre_dispute_status: "confirmed",
      dispute_reason: "Test dispute 1",
    })
    .eq("id", ids.bookingId);
  assert(!disputeRes1.error, `dispute setup failed: ${disputeRes1.error?.message}`);

  const disputesListRes = await authedFetch(adminJar, `${BASE_URL}/api/admin/bookings/disputes`);
  const disputesListBody = await disputesListRes.json();
  assert(
    disputesListBody.data.disputes.some((d) => d.id === ids.bookingId),
    "booking should appear in disputes list"
  );

  const dismissRes = await authedFetch(
    adminJar,
    `${BASE_URL}/api/admin/bookings/${ids.bookingId}/resolve`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution: "dismiss", note: "No issue found." }),
    }
  );
  const dismissBody = await dismissRes.json();
  assert(dismissRes.status === 200, `dismiss failed: ${JSON.stringify(dismissBody)}`);
  const { data: afterDismiss } = await admin
    .from("bookings")
    .select("status")
    .eq("id", ids.bookingId)
    .single();
  assert(
    afterDismiss.status === "confirmed",
    `expected status restored to 'confirmed', got ${afterDismiss.status}`
  );
  console.log("   OK — dismissed, status correctly restored to pre-dispute state");

  console.log("8. Dispute flow: raise again -> resolve with a REAL Stripe refund...");
  await admin
    .from("bookings")
    .update({
      status: "disputed",
      pre_dispute_status: "confirmed",
      dispute_reason: "Test dispute 2",
    })
    .eq("id", ids.bookingId);

  const nonAdminForbidden = await authedFetch(
    new Map(),
    `${BASE_URL}/api/admin/bookings/${ids.bookingId}/resolve`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution: "refund", note: "x" }),
    }
  );
  assert(
    nonAdminForbidden.status === 401,
    `expected 401 with no session, got ${nonAdminForbidden.status}`
  );

  const refundRes = await authedFetch(
    adminJar,
    `${BASE_URL}/api/admin/bookings/${ids.bookingId}/resolve`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution: "refund", refund_pence: 8000, note: "Refunded in full." }),
    }
  );
  const refundBody = await refundRes.json();
  assert(refundRes.status === 200, `refund failed: ${JSON.stringify(refundBody)}`);
  assert(refundBody.data.refund_pence === 8000, "refund_pence should be 8000");
  console.log(
    "   transfer_reversed:",
    refundBody.data.transfer_reversed,
    "(expected false — no transfer existed yet)"
  );

  const refunds = await stripe.refunds.list({ payment_intent: ids.paymentIntentId, limit: 1 });
  assert(
    refunds.data.length === 1 && refunds.data[0].status === "succeeded",
    "a real Stripe refund should exist and have succeeded"
  );

  const { data: afterRefund } = await admin
    .from("bookings")
    .select("status")
    .eq("id", ids.bookingId)
    .single();
  assert(
    afterRefund.status === "refunded",
    `expected status 'refunded', got ${afterRefund.status}`
  );
  console.log(
    "   OK — real Stripe refund issued and confirmed via the Stripe API, booking marked refunded"
  );

  console.log("9. Platform report sanity check...");
  const reportRes = await authedFetch(
    adminJar,
    `${BASE_URL}/api/admin/reports/platform?period=week`
  );
  const reportBody = await reportRes.json();
  assert(reportRes.status === 200, `report failed: ${JSON.stringify(reportBody)}`);
  assert(reportBody.data.bookings.total >= 1, "report should count at least our test booking");
  assert(typeof reportBody.data.gmv_pence === "number", "gmv_pence should be a number");
  assert(
    Array.isArray(reportBody.data.time_series.buckets),
    "time_series.buckets should be an array"
  );
  console.log(
    "   OK — report shape correct:",
    JSON.stringify({ bookings: reportBody.data.bookings, gmv_pence: reportBody.data.gmv_pence })
  );

  console.log("\nAll checks passed — Admin Panel works end-to-end against real Supabase + Stripe.");
} finally {
  // Cleanup is marker-based and self-verifying - see scripts/lib/smoketest.mjs.
  //
  // finishTeardown() reaps every @braidr.internal.test fixture (so a crash
  // before an id was recorded still gets cleaned), checks the .error each
  // delete RETURNS rather than assuming a failure would throw, and exits
  // NON-ZERO listing whatever survived. The teardown this replaced deleted by
  // captured ids and read no errors at all, which is how a publicly listed
  // braider was stranded for three days on 2026-08-31.
  console.log("\nCleaning up...");
  await finishTeardown(admin);
}
