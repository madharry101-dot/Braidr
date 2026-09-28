// R-06 — proves the webhook dedup ledger against the REAL database.
//
// Jest cannot test this. The guarantee is a Postgres one: an atomic claim,
// a lease that expires, and a row lock that makes two simultaneous claims
// resolve to exactly one winner. Mocking any of that would only test the mock.
//
// Each scenario is run twice: once against the lease-based claim function,
// and once against a NAIVE "insert first, presence means done" model built
// from plain inserts on the same table. The naive model is what you get if
// you reach for the obvious dedup, and both scenarios show it losing events.
//
//   node scripts/verify-webhook-dedup.mjs
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

const RUN = Date.now();
const PREFIX = `evt_verify_${RUN}`;
const results = [];

function check(scenario, model, expectation, actual, pass) {
  results.push({ scenario, model, pass });
  console.log(`  ${pass ? "PASS" : "FAIL"}  [${model}] ${expectation}`);
  if (!pass) console.log(`        got: ${actual}`);
}

const claim = (id, lease = 60) =>
  admin.rpc("claim_stripe_webhook_event", {
    p_event_id: id,
    p_type: "test.event",
    p_lease_seconds: lease,
  });
const release = (id) => admin.rpc("release_stripe_webhook_event", { p_event_id: id });
const complete = (id) => admin.rpc("complete_stripe_webhook_event", { p_event_id: id });

// The naive model: one insert, and presence alone means "already handled".
async function naiveClaim(id) {
  const { error } = await admin
    .from("stripe_webhook_events")
    .insert({ event_id: id, type: "test.event" });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  throw error;
}

try {
  // ---------------------------------------------------------------------
  console.log("\nSCENARIO 1 — the handler throws, and Stripe retries.");
  console.log("  The event MUST still get processed on the retry.\n");

  const e1 = `${PREFIX}_throw_lease`;
  const first = (await claim(e1)).data;
  await release(e1); // handler threw -> route releases the lease, returns 5xx
  const retry = (await claim(e1)).data;
  check(
    "handler-throws",
    "lease",
    'retry reclaims the event (expected "reclaimed")',
    `first=${first} retry=${retry}`,
    first === "claimed" && retry === "reclaimed"
  );

  const e1n = `${PREFIX}_throw_naive`;
  const firstN = await naiveClaim(e1n);
  // Nothing to release — the naive model already recorded it as handled.
  const retryN = await naiveClaim(e1n);
  check(
    "handler-throws",
    "naive",
    'retry is WRONGLY swallowed (shows "duplicate" = event lost)',
    `first=${firstN} retry=${retryN}`,
    firstN === "claimed" && retryN === "duplicate"
  );

  // ---------------------------------------------------------------------
  console.log("\nSCENARIO 2 — the same event delivered twice at once.");
  console.log("  Exactly one worker may proceed; the other must NOT be told it is done.\n");

  const e2 = `${PREFIX}_concurrent_lease`;
  const pair = await Promise.all([claim(e2), claim(e2)]);
  const outcomes = pair.map((r) => r.data).sort();
  check(
    "concurrent-duplicate",
    "lease",
    'one "claimed", one "in_flight" (retryable, not acknowledged)',
    JSON.stringify(outcomes),
    outcomes.length === 2 && outcomes.includes("claimed") && outcomes.includes("in_flight")
  );

  const e2n = `${PREFIX}_concurrent_naive`;
  const pairN = (await Promise.all([naiveClaim(e2n), naiveClaim(e2n)])).sort();
  // The loser is told "duplicate" — i.e. already handled — while the winner
  // has not finished, and may never finish. A 200 here is a lie.
  const naiveLies = pairN.includes("duplicate") && pairN.includes("claimed");
  const { data: naiveRow } = await admin
    .from("stripe_webhook_events")
    .select("status, processed_at")
    .eq("event_id", e2n)
    .single();
  check(
    "concurrent-duplicate",
    "naive",
    'loser is WRONGLY told "duplicate" while the row is still unprocessed',
    `${JSON.stringify(pairN)} row.status=${naiveRow?.status} processed_at=${naiveRow?.processed_at}`,
    naiveLies && naiveRow?.status === "processing" && naiveRow?.processed_at === null
  );

  // ---------------------------------------------------------------------
  console.log("\nSCENARIO 3 — supporting behaviour.\n");

  const e3 = `${PREFIX}_processed`;
  await claim(e3);
  await complete(e3);
  const dup = (await claim(e3)).data;
  check(
    "genuine-duplicate",
    "lease",
    'a finished event returns "already_processed"',
    dup,
    dup === "already_processed"
  );

  const e4 = `${PREFIX}_inflight`;
  await claim(e4);
  const held = (await claim(e4)).data;
  check("lease-held", "lease", 'a live lease returns "in_flight"', held, held === "in_flight");

  const e5 = `${PREFIX}_expired`;
  await claim(e5, 0); // zero-second lease: the next claim must reclaim it
  const reclaimed = (await claim(e5, 0)).data;
  const { data: row5 } = await admin
    .from("stripe_webhook_events")
    .select("attempts")
    .eq("event_id", e5)
    .single();
  check(
    "crash-recovery",
    "lease",
    "an expired lease is reclaimed and attempts climbs",
    `${reclaimed} attempts=${row5?.attempts}`,
    reclaimed === "reclaimed" && row5?.attempts === 2
  );
} finally {
  const { error } = await admin
    .from("stripe_webhook_events")
    .delete()
    .like("event_id", `${PREFIX}%`);
  const { count } = await admin
    .from("stripe_webhook_events")
    .select("event_id", { count: "exact", head: true })
    .like("event_id", `${PREFIX}%`);
  console.log(
    `\ncleanup: ${error ? "FAILED " + error.message : "ok"} — ${count ?? "?"} test row(s) remain`
  );

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length || count !== 0) {
    console.error("VERIFICATION FAILED");
    process.exitCode = 1;
  } else {
    console.log("R-06 dedup ledger behaves as designed.");
  }
}
