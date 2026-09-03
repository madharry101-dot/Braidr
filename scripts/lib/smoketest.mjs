// Shared plumbing for the scripts/smoke-test-*.mjs scripts.
//
// WHY THIS EXISTS — a real incident, not a tidiness exercise.
//
// On 2026-08-31 a run of smoke-test-braidcare.mjs against production left two
// users behind. One carried an ACTIVE braider_profiles row with a service, in
// London, visible through the public_profiles view — so "BraidCare Smoke Test
// Braider" sat in the live public braider directory for three days.
//
// The cause was NOT that cleanup crashed. Cleanup ran, failed, printed "Done."
// and exited 0. supabase-js does not throw on a failed delete — it returns
// { data, error } — and not one of the twelve teardowns read that error. A
// cleanup path that reports success on total failure is worse than one that
// crashes, because crashing gets noticed.
//
// So everything here is built around two rules:
//   1. A failure is only a failure if something SEES it. Every step checks the
//      returned .error as well as catching throws, and the run ends by
//      asserting nothing survived — exiting non-zero, with detail, if it did.
//   2. Cleanup must not depend on the run that created the mess. Discovery is
//      by durable MARKER (email domain, storage-path prefix), not by ids held
//      in a variable that a mid-run crash never populated.
//
// ── MARKERS, AND ONE COLLISION THAT MATTERS ─────────────────────────────────
// Smoke-test fixtures live at @braidr.internal.test. The demo seed data from
// seed-braidmatch-demo.mjs lives at @demo.braidr, is intentionally permanent,
// and includes four PUBLICLY LISTED braiders. The two must never be confused:
// a reaper pointed at @demo.braidr would delete the demo marketplace.
//
// PROTECTED_EMAIL_DOMAIN makes that a rule enforced in code rather than one
// somebody has to remember. Nothing in this module will touch an address in it.

/** Fixtures created by smoke tests. Safe to delete, always. */
export const SMOKETEST_EMAIL_DOMAIN = "braidr.internal.test";
/** Permanent demo seed data. NEVER deleted by any of this. */
export const PROTECTED_EMAIL_DOMAIN = "demo.braidr";
/** Prefix for any storage object a smoke test uploads. */
export const SMOKETEST_STORAGE_PREFIX = "smoketest-";

/** Unique, marker-bearing address. Use this rather than hand-rolling one. */
export function smoketestEmail(tag) {
  return "smoketest-" + tag + "-" + Date.now() + "@" + SMOKETEST_EMAIL_DOMAIN;
}

export function isProtectedEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith("@" + PROTECTED_EMAIL_DOMAIN);
}

export function isSmoketestEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith("@" + SMOKETEST_EMAIL_DOMAIN);
}

// Tables a smoke test writes that hang off a USER id, children first. Order
// matters: reversed, these produce FK violations — which, before this module,
// were exactly the silent errors nobody read.
const USER_SCOPED_TABLES = [
  { table: "braidcare_sessions", column: "client_id" },
  { table: "braidcare_subscriptions", column: "user_id" },
  { table: "expert_referrals", column: "client_id" },
  { table: "newsletter_sends", column: "recipient_user_id" },
  { table: "newsletter_subscriptions", column: "user_id" },
  { table: "consent_events", column: "user_id" },
  { table: "braidr_pro_progress", column: "user_id" },
  { table: "blog_posts", column: "author_id" },
  { table: "expert_profiles", column: "user_id" },
];

// Tables reached through a braider_profiles.id rather than a user id.
const BRAIDER_SCOPED_TABLES = [
  { table: "braider_texture_specialisations", column: "braider_id" },
  { table: "braider_portfolio_photos", column: "braider_id" },
  { table: "reviews", column: "braider_id" },
  { table: "braider_availability_rules", column: "braider_id" },
  { table: "braider_blocked_dates", column: "braider_id" },
  { table: "income_records", column: "braider_id" },
  { table: "services", column: "braider_id" },
];

const BUCKETS = [
  "scalp-photos",
  "portfolio-photos",
  "avatars",
  "insurance-documents",
  "expert-credentials",
  "blog-images",
];

/**
 * Finds every smoke-test artefact currently in the database, by marker,
 * regardless of which run created it. READ-ONLY.
 *
 * Both the reaper (including --dry-run) and teardown verification are built on
 * this one function, so what reports and what deletes can never disagree.
 */
export async function discoverArtefacts(admin) {
  const found = { users: [], braiderProfiles: [], rows: [], storage: [] };

  // Users by email marker. listUsers is paginated — walk it rather than
  // assuming a single page, or a long-lived project quietly hides debris.
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("listUsers failed: " + error.message);
    const users = data?.users ?? [];
    for (const u of users) {
      if (isProtectedEmail(u.email)) continue; // demo seed data — never ours
      if (isSmoketestEmail(u.email)) {
        found.users.push({ id: u.id, email: u.email, created_at: u.created_at });
      }
    }
    if (users.length < 200) break;
    page += 1;
  }

  const userIds = found.users.map((u) => u.id);

  if (userIds.length > 0) {
    const { data: bps } = await admin
      .from("braider_profiles")
      .select("id, user_id, is_active, city")
      .in("user_id", userIds);
    found.braiderProfiles = bps ?? [];
    const braiderIds = found.braiderProfiles.map((b) => b.id);

    for (const { table, column } of USER_SCOPED_TABLES) {
      const { data } = await admin.from(table).select("id").in(column, userIds);
      if (data?.length) found.rows.push({ table, column, ids: data.map((r) => r.id) });
    }

    // Bookings reference a user on one side and a braider profile on the other.
    const bookingIds = new Set();
    const { data: bkClient } = await admin.from("bookings").select("id").in("client_id", userIds);
    for (const r of bkClient ?? []) bookingIds.add(r.id);

    if (braiderIds.length > 0) {
      for (const { table, column } of BRAIDER_SCOPED_TABLES) {
        const { data } = await admin.from(table).select("id").in(column, braiderIds);
        if (data?.length) found.rows.push({ table, column, ids: data.map((r) => r.id) });
      }
      const { data: bkBraider } = await admin
        .from("bookings")
        .select("id")
        .in("braider_id", braiderIds);
      for (const r of bkBraider ?? []) bookingIds.add(r.id);
    }

    if (bookingIds.size > 0) {
      found.rows.push({ table: "bookings", column: "id", ids: [...bookingIds] });
    }
  }

  // Storage by path prefix, independent of the user list — so an object whose
  // owning user was already deleted is still found.
  for (const bucket of BUCKETS) {
    const { data, error } = await admin.storage.from(bucket).list("", { limit: 1000 });
    if (error) continue; // bucket may not exist in a given environment
    for (const entry of data ?? []) {
      if (entry.name?.startsWith(SMOKETEST_STORAGE_PREFIX)) {
        found.storage.push({ bucket, path: entry.name });
        continue;
      }
      // Objects are normally namespaced under a user-id folder; look one level
      // in, since the prefix is on the filename rather than the folder.
      if (!entry.name?.includes(".")) {
        const { data: inner } = await admin.storage.from(bucket).list(entry.name, { limit: 1000 });
        for (const f of inner ?? []) {
          if (f.name?.startsWith(SMOKETEST_STORAGE_PREFIX)) {
            found.storage.push({ bucket, path: entry.name + "/" + f.name });
          }
        }
      }
    }
  }

  return found;
}

export function countArtefacts(found) {
  return (
    found.users.length +
    found.braiderProfiles.length +
    found.rows.reduce((n, r) => n + r.ids.length, 0) +
    found.storage.length
  );
}

/**
 * Prints artefacts with enough specificity to clean up by hand — table, actual
 * ids, and whether a stranded braider is publicly listed. "Something remains"
 * is barely better than silence, which is the bar this has to clear.
 */
export function reportArtefacts(found, { heading } = {}) {
  if (heading) console.log(heading);
  for (const u of found.users) {
    console.log("  auth.users            " + u.id + "  " + u.email);
  }
  for (const b of found.braiderProfiles) {
    const flag = b.is_active
      ? "  <-- is_active=true, PUBLICLY LISTED"
      : "  (is_active=false, not listed)";
    console.log("  braider_profiles      " + b.id + "  city=" + b.city + flag);
  }
  for (const r of found.rows) {
    const shown = r.ids.slice(0, 5).join(", ") + (r.ids.length > 5 ? ", ..." : "");
    console.log("  " + r.table.padEnd(22) + r.ids.length + " row(s): " + shown);
  }
  for (const s of found.storage) {
    console.log("  storage/" + s.bucket.padEnd(21) + s.path);
  }
}

/**
 * Runs teardown steps so that no single failure can hide or abort the others.
 *
 * Each step's fn may throw OR return a supabase result carrying .error. Both
 * count as failure — the second is the one that caused the incident.
 */
export function createTeardown() {
  const steps = [];
  return {
    step(label, fn) {
      steps.push({ label, fn });
      return this;
    },
    async run() {
      const failures = [];
      for (const { label, fn } of steps) {
        try {
          const result = await fn();
          const err = result && typeof result === "object" ? result.error : null;
          if (err) failures.push({ label, reason: err.message ?? String(err) });
        } catch (e) {
          failures.push({ label, reason: e instanceof Error ? e.message : String(e) });
        }
      }
      return failures;
    },
  };
}

/**
 * The last thing a smoke test does. Re-discovers by marker and exits NON-ZERO
 * with full detail if anything survived, so a partial cleanup fails loudly
 * instead of printing "Done."
 *
 * Usage:  await finishTeardown(admin, await teardown.run());
 */
export async function finishTeardown(admin, failures = []) {
  for (const f of failures) {
    console.error("  x teardown step failed: " + f.label + " -- " + f.reason);
  }

  let found;
  try {
    found = await discoverArtefacts(admin);
  } catch (e) {
    console.error("  x could not verify teardown: " + e.message);
    process.exitCode = 1;
    return;
  }

  const n = countArtefacts(found);
  if (n === 0 && failures.length === 0) {
    console.log("Done - verified: no smoke-test artefacts remain.");
    return;
  }

  if (n > 0) {
    console.error("\nTEARDOWN INCOMPLETE - " + n + " artefact(s) still in PRODUCTION:");
    reportArtefacts(found);
    console.error("\n  Inspect with: node scripts/reap-smoketest-data.mjs --dry-run");
    console.error("  Remove with:  node scripts/reap-smoketest-data.mjs");
  }
  process.exitCode = 1;
}
