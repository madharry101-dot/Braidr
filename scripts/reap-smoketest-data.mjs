// Removes every smoke-test artefact from the database, by marker, regardless
// of which run created it. Safe to run at any time; safe to run twice.
//
//   node scripts/reap-smoketest-data.mjs --dry-run    report only, change nothing
//   node scripts/reap-smoketest-data.mjs              actually remove
//
// WHY IT EXISTS
// Smoke tests write to the real database — there is no staging. On 2026-08-31 a
// run left an ACTIVE braider_profiles row behind, publicly listed in the live
// braider directory for three days, because its teardown deleted by ids held in
// a variable and silently ignored every error. Discovery here is by durable
// MARKER instead, so this cleans up after runs that crashed before recording
// anything, and after runs that finished months ago.
//
// WHAT IT WILL NEVER TOUCH
// The demo seed data from seed-braidmatch-demo.mjs, which lives at
// @demo.braidr, is intentionally permanent, and includes four publicly listed
// braiders. Only @braidr.internal.test addresses are in scope. That exclusion
// is enforced in scripts/lib/smoketest.mjs (isProtectedEmail) rather than left
// to whoever reads this comment — see the marker note there.
//
// KNOWN GAP, deliberately not papered over: smoke-test-braidcare-subscription
// creates no user of its own. It mutates the seeded demo-client account
// (inserting a braidcare_subscriptions row and setting
// profiles.braidcare_client_subscribed). Those artefacts carry no marker, so
// this reaper cannot find them and must not guess — reaping by account would
// mean touching protected demo data. That script needs its own fixture user;
// flagged rather than worked around.
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  discoverArtefacts,
  countArtefacts,
  reportArtefacts,
  createTeardown,
  isProtectedEmail,
  PROTECTED_EMAIL_DOMAIN,
  SMOKETEST_EMAIL_DOMAIN,
} from "./lib/smoketest.mjs";

globalThis.WebSocket = WebSocket;

const DRY_RUN = process.argv.includes("--dry-run");

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

console.log(DRY_RUN ? "DRY RUN - nothing will be removed.\n" : "REAPING smoke-test data.\n");
console.log("  in scope : *@" + SMOKETEST_EMAIL_DOMAIN + " and storage paths prefixed smoketest-");
console.log("  protected: *@" + PROTECTED_EMAIL_DOMAIN + " (demo seed data) - never touched\n");

const found = await discoverArtefacts(admin);
const total = countArtefacts(found);

if (total === 0) {
  console.log("Nothing to do - no smoke-test artefacts found.");
  process.exit(0);
}

reportArtefacts(found, { heading: "Found " + total + " artefact(s):" });

// A publicly listed stranded braider is the specific failure this exists to
// catch, so call it out rather than leaving it in a list of ids.
const listed = found.braiderProfiles.filter((b) => b.is_active);
if (listed.length > 0) {
  console.log(
    "\n  WARNING: " +
      listed.length +
      " stranded braider profile(s) are is_active=true and therefore visible in the public directory right now."
  );
}

if (DRY_RUN) {
  console.log("\nDry run complete. Re-run without --dry-run to remove the above.");
  process.exit(0);
}

// Belt and braces: re-assert the protection immediately before deleting, so a
// future change to discovery can never quietly widen what gets destroyed.
for (const u of found.users) {
  if (isProtectedEmail(u.email)) {
    console.error("REFUSING TO PROCEED: protected address in delete set: " + u.email);
    process.exit(1);
  }
}

console.log("\nRemoving...");
const teardown = createTeardown();

// Children first. found.rows is already in FK-safe order from discovery.
for (const r of found.rows) {
  teardown.step(r.table + " (" + r.ids.length + ")", () =>
    admin.from(r.table).delete().in("id", r.ids)
  );
}
for (const s of found.storage) {
  teardown.step("storage/" + s.bucket + " " + s.path, () =>
    admin.storage.from(s.bucket).remove([s.path])
  );
}
for (const b of found.braiderProfiles) {
  teardown.step("braider_profiles " + b.id, () =>
    admin.from("braider_profiles").delete().eq("id", b.id)
  );
}
// Users last: profiles cascade from auth.users, and deleting a user before its
// dependent rows is what produced the original FK failures.
for (const u of found.users) {
  teardown.step("auth.users " + u.email, () => admin.auth.admin.deleteUser(u.id));
}

const failures = await teardown.run();
for (const f of failures) {
  console.error("  x " + f.label + " -- " + f.reason);
}

const left = await discoverArtefacts(admin);
const remaining = countArtefacts(left);

if (remaining === 0) {
  console.log("\nDone - verified clean, 0 artefacts remain.");
  process.exit(0);
}

console.error("\nINCOMPLETE - " + remaining + " artefact(s) still present:");
reportArtefacts(left);
console.error(
  "\nThese need manual attention. FK order or a permission problem is the usual cause."
);
process.exit(1);
