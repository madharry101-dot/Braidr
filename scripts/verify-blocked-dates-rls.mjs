// R-12 — proves who can read and write braider_blocked_dates, using REAL
// roles against the REAL database.
//
// Jest cannot test this. The guarantee is a Postgres one: row-level security
// evaluated for an actual anon key and an actual signed-in JWT. A mock would
// only test the mock.
//
// Run it BEFORE dropping blocked_dates_select_any and the base-table secrecy
// checks FAIL, which is the point — that is the finding. Run it after, and
// they pass.
//
//   node scripts/verify-blocked-dates-rls.mjs
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

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "correct-horse-battery-staple-9";
const TAG = `smoketest-rls-${Date.now()}`;
const SECRET_REASON = `private-reason-${TAG}`;

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, noSession);

const results = [];
function check(label, pass, detail = "") {
  results.push({ label, pass });
  console.log(
    `  ${pass ? "PASS" : "FAIL"}  ${label}${pass || !detail ? "" : `\n          ${detail}`}`
  );
}

async function makeBraider(suffix) {
  const email = `${TAG}-${suffix}@braidr.internal.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "braider", full_name: `RLS Probe ${suffix}` },
  });
  if (error) throw error;
  const { data: profile, error: pErr } = await admin
    .from("braider_profiles")
    // is_active false: this fixture must never appear in the public directory.
    .insert({ user_id: data.user.id, city: "London", is_active: false })
    .select("id")
    .single();
  if (pErr) throw pErr;

  const client = createClient(URL, ANON, noSession);
  const { error: sErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (sErr) throw sErr;
  return { email, userId: data.user.id, braiderId: profile.id, client };
}

let owner = null;
let other = null;

try {
  console.log("setting up two real braiders...\n");
  owner = await makeBraider("owner");
  other = await makeBraider("other");
  const anon = createClient(URL, ANON, noSession);

  // ---------------------------------------------------------------
  console.log("WRITE PATH");

  const { error: ownInsert } = await owner.client
    .from("braider_blocked_dates")
    .insert({ braider_id: owner.braiderId, blocked_date: "2027-01-15", reason: SECRET_REASON });
  check("a braider can block a date on their own profile", !ownInsert, ownInsert?.message);

  const { error: crossInsert } = await other.client
    .from("braider_blocked_dates")
    .insert({ braider_id: owner.braiderId, blocked_date: "2027-02-20", reason: "injected" });
  check("a DIFFERENT braider cannot block a date on someone else's profile", !!crossInsert);

  const { error: anonInsert } = await anon
    .from("braider_blocked_dates")
    .insert({ braider_id: owner.braiderId, blocked_date: "2027-03-25", reason: "injected" });
  check("an anonymous caller cannot block a date at all", !!anonInsert);

  // ---------------------------------------------------------------
  console.log("\nTHE OWNER'S OWN ROWS");

  const { data: ownRead, error: ownErr } = await owner.client
    .from("braider_blocked_dates")
    .select("blocked_date, reason")
    .eq("braider_id", owner.braiderId);
  check(
    "a braider can still read their own rows INCLUDING reason",
    !ownErr && ownRead?.length === 1 && ownRead[0].reason === SECRET_REASON,
    ownErr?.message ?? `rows=${ownRead?.length} reason=${ownRead?.[0]?.reason}`
  );

  const { error: ownDelete } = await owner.client
    .from("braider_blocked_dates")
    .delete()
    .eq("braider_id", owner.braiderId)
    .eq("blocked_date", "2027-01-15");
  check("a braider can still unblock their own date", !ownDelete, ownDelete?.message);

  // Put it back for the read tests below.
  await owner.client
    .from("braider_blocked_dates")
    .insert({ braider_id: owner.braiderId, blocked_date: "2027-01-15", reason: SECRET_REASON });

  // ---------------------------------------------------------------
  console.log("\nTHE PUBLIC VIEW — what the booking flow needs");

  for (const [who, client] of [
    ["anon", anon],
    ["another signed-in user", other.client],
  ]) {
    const { data, error } = await client
      .from("public_blocked_dates")
      .select("braider_id, blocked_date")
      .eq("braider_id", owner.braiderId);
    check(
      `${who} CAN read the view (the booking flow depends on this)`,
      !error && data?.length === 1 && data[0].blocked_date === "2027-01-15",
      error?.message ?? `rows=${data?.length}`
    );
  }

  const { error: viewReason } = await anon.from("public_blocked_dates").select("reason").limit(1);
  check("the view does not even have a reason column", !!viewReason);

  // ---------------------------------------------------------------
  console.log("\nTHE BASE TABLE — what nobody else should see");
  console.log("  (these are the checks that FAIL while blocked_dates_select_any exists)");

  for (const [who, client] of [
    ["anon", anon],
    ["another signed-in user", other.client],
  ]) {
    const { data, error } = await client
      .from("braider_blocked_dates")
      .select("reason")
      .eq("braider_id", owner.braiderId);
    const leaked = !error && (data ?? []).some((r) => r.reason === SECRET_REASON);
    check(`${who} CANNOT read reason on the base table`, !leaked, `leaked=${leaked}`);

    const { data: rows } = await client
      .from("braider_blocked_dates")
      .select("braider_id")
      .eq("braider_id", owner.braiderId);
    check(
      `${who} CANNOT read anyone else's rows on the base table`,
      (rows ?? []).length === 0,
      `rows=${rows?.length}`
    );
  }
} finally {
  console.log("\ncleaning up...");
  for (const f of [owner, other].filter(Boolean)) {
    await admin.from("braider_blocked_dates").delete().eq("braider_id", f.braiderId);
    await admin.from("braider_profiles").delete().eq("id", f.braiderId);
    const { error } = await admin.auth.admin.deleteUser(f.userId);
    console.log(`  ${f.email}: ${error ? "FAILED " + error.message : "ok"}`);
  }
  const { data: left } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const strays = (left?.users ?? []).filter((u) => u.email?.includes(TAG));
  console.log(
    strays.length === 0
      ? "  verified clean — 0 fixtures remain"
      : `  INCOMPLETE — ${strays.length} remain`
  );

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error("\nFAILED:");
    failed.forEach((f) => console.error(`  - ${f.label}`));
    process.exitCode = 1;
  }
}
