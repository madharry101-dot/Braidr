// One-off verification script — not part of the app. Exercises the real
// Braidr Pro pathway end-to-end against the live Supabase project:
//   1. Creates a test braider
//   2. POST /api/pro/assessment — Step 1
//   3. PUT /api/pro/steps/2 — HMRC/UTR (encrypted at rest)
//   4. PUT /api/pro/steps/3 — insurance document upload
//   5. PUT /api/pro/steps/4 — banking; confirms the verified badge is
//      awarded, and that the braider CANNOT self-award it directly
//   6. PUT /api/pro/steps/5 — growth & CPD
//   7. Confirms sequential unlock actually blocks a skipped step
//   8. Creates a completed booking + income_record, generates a real
//      invoice PDF, confirms it's a real PDF
//   9. GET /api/pro/income + /export (CSV) — checks the numbers
//   10. Cleans up every row and every uploaded object it created
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

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ids = {
  braiderUserId: null,
  braiderProfileId: null,
  clientId: null,
  serviceId: null,
  bookingId: null,
};

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

// A real cookie jar, not a one-shot header string — Supabase's session
// refresh cycle (via middleware.ts on every request) rotates the
// access/refresh token cookies, so a cookie captured once at login goes
// stale after enough subsequent requests. Every authed call below goes
// through authedFetch, which merges the jar in and updates it from each
// response's Set-Cookie.
function updateJarFromResponse(jar, res) {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return;
  for (const part of setCookie.split(/,(?=[^;]+?=[^;]+?)/)) {
    const [nameValue] = part.split(";");
    const eq = nameValue.indexOf("=");
    if (eq === -1) continue;
    jar.set(nameValue.slice(0, eq).trim(), nameValue.slice(eq + 1).trim());
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

async function loginAs(email) {
  const jar = new Map();
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct-horse-battery-staple" }),
  });
  assert(res.ok, `login failed: ${res.status} ${await res.text()}`);
  updateJarFromResponse(jar, res);
  return jar;
}

try {
  const suffix = Date.now();

  console.log("1. Creating test braider + client...");
  const { data: braiderUser } = await admin.auth.admin.createUser({
    email: `smoketest-pro-braider-${suffix}@braidr.internal.test`,
    password: "correct-horse-battery-staple",
    email_confirm: true,
    user_metadata: { role: "braider", full_name: "Pro Smoke Test Braider" },
  });
  const { data: clientUser } = await admin.auth.admin.createUser({
    email: `smoketest-pro-client-${suffix}@braidr.internal.test`,
    password: "correct-horse-battery-staple",
    email_confirm: true,
    user_metadata: { role: "client", full_name: "Pro Smoke Test Client" },
  });
  ids.braiderUserId = braiderUser.user.id;
  ids.clientId = clientUser.user.id;

  const { data: braiderProfile } = await admin
    .from("braider_profiles")
    .insert({ user_id: ids.braiderUserId, city: "Aberdeen" })
    .select("id")
    .single();
  ids.braiderProfileId = braiderProfile.id;

  const jar = await loginAs(braiderUser.user.email);
  console.log("   OK — braider:", ids.braiderProfileId);

  console.log("2. Submitting readiness assessment (Step 1)...");
  const assessRes = await authedFetch(jar, `${BASE_URL}/api/pro/assessment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hmrc_registered: false,
      has_insurance: false,
      has_business_bank_account: false,
      files_tax_return: false,
      tracks_income: false,
    }),
  });
  const assessBody = await assessRes.json();
  assert(assessRes.status === 200, `assessment failed: ${JSON.stringify(assessBody)}`);
  assert(assessBody.data.roadmap.length === 5, "roadmap should have 5 steps");
  console.log("   OK — roadmap returned");

  console.log("3. Trying to skip to step 3 (should be blocked)...");
  const skipRes = await authedFetch(jar, `${BASE_URL}/api/pro/steps/3`, {
    method: "PUT",
    body: (() => {
      const fd = new FormData();
      fd.append(
        "document",
        new Blob([Buffer.from("fake pdf")], { type: "application/pdf" }),
        "proof.pdf"
      );
      return fd;
    })(),
  });
  const skipBody = await skipRes.json();
  assert(
    skipRes.status === 422,
    `expected step-skip to be blocked, got ${JSON.stringify(skipBody)}`
  );
  console.log("   OK — sequential unlock correctly enforced");

  console.log("4. Completing Step 2 (HMRC / UTR)...");
  const step2Res = await authedFetch(jar, `${BASE_URL}/api/pro/steps/2`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ utr: "1234567890" }),
  });
  assert(step2Res.status === 200, `step 2 failed: ${JSON.stringify(await step2Res.json())}`);
  console.log("   OK");

  console.log("5. Completing Step 3 (insurance document upload)...");
  const step3FormData = new FormData();
  step3FormData.append(
    "document",
    new Blob([Buffer.from("fake insurance pdf content")], { type: "application/pdf" }),
    "insurance.pdf"
  );
  const step3Res = await authedFetch(jar, `${BASE_URL}/api/pro/steps/3`, {
    method: "PUT",
    body: step3FormData,
  });
  assert(step3Res.status === 200, `step 3 failed: ${JSON.stringify(await step3Res.json())}`);
  console.log("   OK — document uploaded to insurance-documents bucket");

  console.log("6. Completing Step 4 (banking) via the real route...");
  const step4Res = await authedFetch(jar, `${BASE_URL}/api/pro/steps/4`, { method: "PUT" });
  const step4Body = await step4Res.json();
  assert(step4Res.status === 200, `step 4 failed: ${JSON.stringify(step4Body)}`);
  assert(step4Body.data.badge_awarded === true, "step 4 should award the badge");
  console.log("   OK — verified badge awarded");

  console.log("7. Completing Step 5 (growth & CPD)...");
  const step5Res = await authedFetch(jar, `${BASE_URL}/api/pro/steps/5`, { method: "PUT" });
  assert(step5Res.status === 200, `step 5 failed: ${JSON.stringify(await step5Res.json())}`);
  console.log("   OK");

  // Deliberately last among the auth-dependent checks: this uses a SEPARATE
  // Supabase client signed in as the same user (to get a real 'authenticated'
  // role session for the RLS/trigger check, rather than the admin client
  // which is service_role and would trivially bypass what we're testing).
  // Signing in a second client for the same user turned out to disrupt the
  // cookie-jar session used above — sequencing this after all jar-based
  // calls avoids that entirely rather than debugging Supabase Auth's
  // multi-session internals for a one-off test script.
  console.log("8. Verifying overall_progress_pct is 100...");
  const { data: finalProgress } = await admin
    .from("braidr_pro_progress")
    .select("overall_progress_pct, step4_badge_awarded")
    .eq("braider_id", ids.braiderProfileId)
    .single();
  assert(
    finalProgress.overall_progress_pct === 100,
    `expected 100%, got ${finalProgress.overall_progress_pct}`
  );
  assert(finalProgress.step4_badge_awarded === true, "badge should be awarded");
  console.log("   OK — 100% complete, badge awarded");

  console.log("9. Creating a completed booking + income record, generating a real invoice PDF...");
  const { data: service } = await admin
    .from("services")
    .insert({
      braider_id: ids.braiderProfileId,
      name: "Pro Smoke Test Service",
      category: "braids",
      price_from: 9000,
      duration_mins: 90,
    })
    .select("id")
    .single();
  const { data: booking } = await admin
    .from("bookings")
    .insert({
      client_id: ids.clientId,
      braider_id: ids.braiderProfileId,
      service_id: service.id,
      appointment_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      amount_pence: 9000,
      commission_pence: 1080,
      braider_payout_pence: 7920,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  ids.bookingId = booking.id;
  await admin.from("income_records").insert({
    braider_id: ids.braiderProfileId,
    booking_id: booking.id,
    service_name: "Pro Smoke Test Service",
    gross_amount_pence: 9000,
    commission_pence: 1080,
    net_amount_pence: 7920,
    tax_year: "2026-27",
    payment_date: new Date().toISOString().slice(0, 10),
  });

  const invoiceRes = await authedFetch(jar, `${BASE_URL}/api/pro/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: booking.id }),
  });
  assert(invoiceRes.status === 200, `invoice generation failed: ${invoiceRes.status}`);
  assert(invoiceRes.headers.get("content-type") === "application/pdf", "should return a PDF");
  const pdfBuffer = Buffer.from(await invoiceRes.arrayBuffer());
  assert(
    pdfBuffer.slice(0, 4).toString() === "%PDF",
    "response should be a real PDF (starts with %PDF)"
  );
  console.log(`   OK — real PDF generated, ${pdfBuffer.length} bytes`);

  console.log("10. Checking GET /api/pro/income and CSV export...");
  const incomeRes = await authedFetch(jar, `${BASE_URL}/api/pro/income`);
  const incomeBody = await incomeRes.json();
  assert(incomeRes.status === 200, `income fetch failed: ${JSON.stringify(incomeBody)}`);
  const summary = incomeBody.data.tax_year_summaries.find((s) => s.tax_year === "2026-27");
  assert(
    summary?.total_gross_pence === 9000,
    `expected gross 9000, got ${JSON.stringify(summary)}`
  );
  assert(
    summary?.estimated_tax_pence === Math.round(7920 * 0.2),
    "20% estimated tax indicator should match"
  );
  assert(incomeBody.data.disclaimer.includes("does not provide"), "disclaimer must be present");

  const csvRes = await authedFetch(jar, `${BASE_URL}/api/pro/income/export`);
  const csvText = await csvRes.text();
  assert(csvRes.headers.get("content-type").includes("text/csv"), "export should be CSV");
  assert(csvText.includes("90.00"), "CSV should contain the gross amount in pounds");
  console.log("   OK — income summary and CSV export both correct");

  // Deliberately last: uses a SEPARATE Supabase client signed in as the same
  // user (to get a real 'authenticated'-role session for this RLS/trigger
  // check, rather than the admin client, which is service_role and would
  // trivially bypass what we're testing). Signing in a second client for the
  // same user turned out to disrupt the cookie-jar session used by every
  // fetch above — running this only after all jar-based calls are done
  // avoids that entirely, rather than debugging Supabase Auth's
  // multi-session internals for a one-off test script.
  console.log(
    "11. Confirming a braider CANNOT self-award the verified badge directly (real authenticated session, not admin)..."
  );
  // The guard trigger only fires on an actual false->true (or true->false)
  // transition ("is distinct from old") — step4_badge_awarded is already
  // true from the legitimate Step 4 completion, so resubmitting `true`
  // is a same-value no-op that wouldn't exercise the guard. Reset to false
  // via the admin client first so this attempt is the real attack shape.
  await admin
    .from("braidr_pro_progress")
    .update({ step4_badge_awarded: false })
    .eq("braider_id", ids.braiderProfileId);

  const { error: signInError } = await anon.auth.signInWithPassword({
    email: braiderUser.user.email,
    password: "correct-horse-battery-staple",
  });
  assert(!signInError, `sign-in failed: ${signInError?.message}`);
  const { error: selfAwardError } = await anon
    .from("braidr_pro_progress")
    .update({ step4_badge_awarded: true })
    .eq("braider_id", ids.braiderProfileId);
  assert(
    Boolean(selfAwardError),
    "expected the guard trigger to reject a braider self-awarding the badge, but it succeeded"
  );
  console.log("   OK — guard trigger correctly rejected self-award:", selfAwardError.message);
  await anon.auth.signOut();

  console.log("\nAll checks passed — Braidr Pro pathway works end-to-end against real Supabase.");
} finally {
  console.log("\nCleaning up (FK-safe order)...");
  if (ids.bookingId) {
    await admin.from("income_records").delete().eq("booking_id", ids.bookingId);
    await admin.from("bookings").delete().eq("id", ids.bookingId);
  }
  if (ids.braiderProfileId) {
    const { data: progress } = await admin
      .from("braidr_pro_progress")
      .select("step3_insurance_doc_path")
      .eq("braider_id", ids.braiderProfileId)
      .single();
    if (progress?.step3_insurance_doc_path) {
      await admin.storage.from("insurance-documents").remove([progress.step3_insurance_doc_path]);
    }
    await admin.from("braidr_pro_progress").delete().eq("braider_id", ids.braiderProfileId);
    await admin.from("services").delete().eq("braider_id", ids.braiderProfileId);
    await admin.from("braider_profiles").delete().eq("id", ids.braiderProfileId);
  }
  if (ids.braiderUserId) await admin.auth.admin.deleteUser(ids.braiderUserId);
  if (ids.clientId) await admin.auth.admin.deleteUser(ids.clientId);
  console.log("Done.");
}
