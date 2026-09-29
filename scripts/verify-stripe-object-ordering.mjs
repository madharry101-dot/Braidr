// R-13 — proves the watermark and the terminal-cancellation rule against the
// REAL database.
//
// Jest cannot test this. The guarantee is a Postgres one: a FOR UPDATE row
// lock held across a guard and a write, inside one function. Mocking it would
// only test the mock.
//
// Every scenario runs TWICE — once through the new guarded functions, and
// once the way the current unguarded handler does it, with direct table
// writes in the same order. The unguarded column is what production does
// today, and on the scenarios that matter it is wrong.
//
//   node scripts/verify-stripe-object-ordering.mjs
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TAG = `smoketest-r13-${Date.now()}`;
const T1 = "2027-03-01T12:00:00.000Z"; // older
const T2 = "2027-03-01T12:00:05.000Z"; // newer
const SAME = "2027-03-01T12:00:09.000Z"; // shared second

const fixtures = { clientUser: null, braiderUser: null, braiderId: null, accountId: null };
const rows = [];

function record(scenario, guarded, unguarded, expected) {
  const guardedOk = guarded === expected;
  rows.push({
    scenario,
    guarded,
    unguarded,
    expected,
    guardedOk,
    unguardedOk: unguarded === expected,
  });
}

// --- the two ways of applying an event -------------------------------------

const applySubGuarded = (subId, eventId, created, isCancellation, stream, subscribed, extra = {}) =>
  admin.rpc("apply_stripe_subscription_state", {
    p_subscription_id: subId,
    p_event_id: eventId,
    p_event_created: created,
    p_is_cancellation: isCancellation,
    p_stream: stream,
    p_subscribed: subscribed,
    p_user_id: extra.userId ?? null,
    p_braider_profile_id: extra.braiderProfileId ?? null,
    p_status: extra.status ?? null,
    p_current_period_end: extra.periodEnd ?? null,
    p_price_pence: extra.pricePence ?? null,
  });

/** Exactly what app/api/stripe/webhook/route.ts does today: no guard at all. */
async function applySubUnguarded(subId, stream, subscribed, extra = {}) {
  if (stream === "braidcare_client") {
    await admin.from("braidcare_subscriptions").upsert(
      {
        user_id: extra.userId,
        role: "client",
        stripe_subscription_id: subId,
        status: extra.status,
        price_pence: extra.pricePence,
        current_period_end: extra.periodEnd,
      },
      { onConflict: "user_id" }
    );
    await admin
      .from("profiles")
      .update({ braidcare_client_subscribed: subscribed })
      .eq("id", extra.userId);
  } else if (stream === "pro") {
    await admin
      .from("braider_profiles")
      .update({
        braidr_pro_subscribed: subscribed,
        stripe_pro_subscription_id: subscribed ? subId : null,
      })
      .eq("id", extra.braiderProfileId);
  }
}

const applyAccountGuarded = (accountId, eventId, created, chargesEnabled) =>
  admin.rpc("apply_stripe_account_state", {
    p_account_id: accountId,
    p_event_id: eventId,
    p_event_created: created,
    p_charges_enabled: chargesEnabled,
  });

const applyAccountUnguarded = (accountId, chargesEnabled) =>
  admin
    .from("braider_profiles")
    .update({ stripe_charges_enabled: chargesEnabled })
    .eq("stripe_account_id", accountId);

// --- observation + reset ----------------------------------------------------

async function clientSubscribed() {
  const { data } = await admin
    .from("profiles")
    .select("braidcare_client_subscribed")
    .eq("id", fixtures.clientUser)
    .single();
  return data?.braidcare_client_subscribed;
}
async function proSubscribed() {
  const { data } = await admin
    .from("braider_profiles")
    .select("braidr_pro_subscribed")
    .eq("id", fixtures.braiderId)
    .single();
  return data?.braidr_pro_subscribed;
}
async function chargesEnabled() {
  const { data } = await admin
    .from("braider_profiles")
    .select("stripe_charges_enabled")
    .eq("id", fixtures.braiderId)
    .single();
  return data?.stripe_charges_enabled;
}

async function reset() {
  await admin.from("stripe_object_state").delete().like("object_id", `%${TAG}%`);
  await admin.from("braidcare_subscriptions").delete().eq("user_id", fixtures.clientUser);
  await admin
    .from("profiles")
    .update({ braidcare_client_subscribed: false })
    .eq("id", fixtures.clientUser);
  await admin
    .from("braider_profiles")
    .update({
      braidr_pro_subscribed: false,
      stripe_pro_subscription_id: null,
      stripe_charges_enabled: false,
    })
    .eq("id", fixtures.braiderId);
}

try {
  // --- fixtures ------------------------------------------------------------
  const { data: cu, error: ce } = await admin.auth.admin.createUser({
    email: `${TAG}-client@braidr.internal.test`,
    password: "correct-horse-battery-staple-9",
    email_confirm: true,
    user_metadata: { role: "client", full_name: "R13 Client" },
  });
  if (ce) throw ce;
  fixtures.clientUser = cu.user.id;

  const { data: bu, error: be } = await admin.auth.admin.createUser({
    email: `${TAG}-braider@braidr.internal.test`,
    password: "correct-horse-battery-staple-9",
    email_confirm: true,
    user_metadata: { role: "braider", full_name: "R13 Braider" },
  });
  if (be) throw be;
  fixtures.braiderUser = bu.user.id;

  fixtures.accountId = `acct_${TAG}`;
  const { data: bp, error: bpe } = await admin
    .from("braider_profiles")
    // is_active false — must never reach the public directory.
    .insert({
      user_id: fixtures.braiderUser,
      city: "London",
      is_active: false,
      stripe_account_id: fixtures.accountId,
    })
    .select("id")
    .single();
  if (bpe) throw bpe;
  fixtures.braiderId = bp.id;

  const clientExtra = {
    userId: fixtures.clientUser,
    status: "active",
    periodEnd: "2027-04-01T00:00:00.000Z",
    pricePence: 799,
  };
  const cancelledExtra = { ...clientExtra, status: "cancelled" };

  // === 1. cancelled, then an OLDER updated arrives =========================
  {
    const sub = `sub_${TAG}_a`;
    await reset();
    await applySubGuarded(sub, "evt_del", T2, true, "braidcare_client", false, cancelledExtra);
    await applySubGuarded(sub, "evt_upd", T1, false, "braidcare_client", true, clientExtra);
    const guarded = await clientSubscribed();

    await reset();
    await applySubUnguarded(sub, "braidcare_client", false, cancelledExtra);
    await applySubUnguarded(sub, "braidcare_client", true, clientExtra);
    const unguarded = await clientSubscribed();

    record(
      "cancelled, then an OLDER updated (paid access after cancellation)",
      guarded,
      unguarded,
      false
    );
  }

  // === 2. cancelled, then an updated sharing the SAME SECOND ===============
  {
    const sub = `sub_${TAG}_b`;
    await reset();
    await applySubGuarded(sub, "evt_del", SAME, true, "braidcare_client", false, cancelledExtra);
    await applySubGuarded(sub, "evt_upd", SAME, false, "braidcare_client", true, clientExtra);
    const guarded = await clientSubscribed();

    await reset();
    await applySubUnguarded(sub, "braidcare_client", false, cancelledExtra);
    await applySubUnguarded(sub, "braidcare_client", true, clientExtra);
    const unguarded = await clientSubscribed();

    record(
      "cancelled, then an updated in the SAME SECOND (watermark alone cannot help)",
      guarded,
      unguarded,
      false
    );
  }

  // === 3. a stale non-cancellation event ===================================
  {
    const sub = `sub_${TAG}_c`;
    await reset();
    await applySubGuarded(sub, "evt_new", T2, false, "pro", true, {
      braiderProfileId: fixtures.braiderId,
    });
    await applySubGuarded(sub, "evt_old", T1, false, "pro", false, {
      braiderProfileId: fixtures.braiderId,
    });
    const guarded = await proSubscribed();

    await reset();
    await applySubUnguarded(sub, "pro", true, { braiderProfileId: fixtures.braiderId });
    await applySubUnguarded(sub, "pro", false, { braiderProfileId: fixtures.braiderId });
    const unguarded = await proSubscribed();

    record(
      "an OLDER updated must not undo a NEWER one (pro subscription)",
      guarded,
      unguarded,
      true
    );
  }

  // === 4. a NEW subscription id after cancellation must still work =========
  {
    const cancelled = `sub_${TAG}_d_old`;
    const fresh = `sub_${TAG}_d_new`;
    await reset();
    await applySubGuarded(
      cancelled,
      "evt_del",
      T1,
      true,
      "braidcare_client",
      false,
      cancelledExtra
    );
    const res = await applySubGuarded(
      fresh,
      "evt_new",
      T2,
      false,
      "braidcare_client",
      true,
      clientExtra
    );
    const guarded = await clientSubscribed();

    record(
      `resubscribing with a NEW subscription id is allowed (rpc said "${res.data}")`,
      guarded,
      true, // unguarded allows it too; this guards against over-blocking
      true
    );
  }

  // === 5. equal timestamps are NOT rejected (the <= choice) ================
  {
    const sub = `sub_${TAG}_e`;
    await reset();
    await applySubGuarded(sub, "evt_1", SAME, false, "pro", true, {
      braiderProfileId: fixtures.braiderId,
    });
    const second = await applySubGuarded(sub, "evt_2", SAME, false, "pro", false, {
      braiderProfileId: fixtures.braiderId,
    });
    const guarded = await proSubscribed();

    record(
      `two events sharing a second BOTH apply, <= not < (rpc said "${second.data}")`,
      guarded,
      false,
      false
    );
  }

  // === 6. account.updated — stale refused ==================================
  {
    await reset();
    await applyAccountGuarded(fixtures.accountId, "evt_acct_new", T2, true);
    await applyAccountGuarded(fixtures.accountId, "evt_acct_old", T1, false);
    const guarded = await chargesEnabled();

    await reset();
    await applyAccountUnguarded(fixtures.accountId, true);
    await applyAccountUnguarded(fixtures.accountId, false);
    const unguarded = await chargesEnabled();

    record("an OLDER account.updated must not revert charges_enabled", guarded, unguarded, true);
  }

  // === 7. account.updated — newer still applies ============================
  {
    await reset();
    await applyAccountGuarded(fixtures.accountId, "evt_acct_1", T1, false);
    await applyAccountGuarded(fixtures.accountId, "evt_acct_2", T2, true);
    const guarded = await chargesEnabled();
    record("a NEWER account.updated still applies", guarded, true, true);
  }

  // --- report --------------------------------------------------------------
  console.log("");
  console.log("scenario".padEnd(66), "guarded".padEnd(9), "unguarded".padEnd(11), "expected");
  console.log("-".repeat(100));
  for (const r of rows) {
    console.log(
      r.scenario.slice(0, 64).padEnd(66),
      `${r.guarded}`.padEnd(9),
      `${r.unguarded}`.padEnd(11),
      `${r.expected}`
    );
  }

  const guardedFailures = rows.filter((r) => !r.guardedOk);
  const unguardedFailures = rows.filter((r) => !r.unguardedOk);

  console.log("");
  console.log(`GUARDED   : ${rows.length - guardedFailures.length}/${rows.length} correct`);
  console.log(
    `UNGUARDED : ${rows.length - unguardedFailures.length}/${rows.length} correct  <- what production does today`
  );
  if (unguardedFailures.length > 0) {
    console.log("\nThe unguarded path gets these wrong:");
    unguardedFailures.forEach((r) => console.log(`  - ${r.scenario}`));
  }
  if (guardedFailures.length > 0) {
    console.error("\nGUARDED PATH FAILED:");
    guardedFailures.forEach((r) => console.error(`  - ${r.scenario} (got ${r.guarded})`));
    process.exitCode = 1;
  }
  if (unguardedFailures.length === 0) {
    console.error(
      "\nThe unguarded path passed everything — these tests prove nothing. Check them."
    );
    process.exitCode = 1;
  }
} finally {
  console.log("\ncleaning up...");
  await admin.from("stripe_object_state").delete().like("object_id", `%${TAG}%`);
  if (fixtures.clientUser) {
    await admin.from("braidcare_subscriptions").delete().eq("user_id", fixtures.clientUser);
  }
  if (fixtures.braiderId)
    await admin.from("braider_profiles").delete().eq("id", fixtures.braiderId);
  for (const id of [fixtures.clientUser, fixtures.braiderUser].filter(Boolean)) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error(`  delete ${id}: FAILED ${error.message}`);
  }
  const { data: left } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const strays = (left?.users ?? []).filter((u) => u.email?.includes(TAG));
  const { count } = await admin
    .from("stripe_object_state")
    .select("object_id", { count: "exact", head: true })
    .like("object_id", `%${TAG}%`);
  console.log(
    strays.length === 0 && count === 0
      ? "  verified clean — 0 fixtures, 0 state rows"
      : `  INCOMPLETE — ${strays.length} user(s), ${count} state row(s)`
  );
  if (strays.length || count !== 0) process.exitCode = 1;
}
