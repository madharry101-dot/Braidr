// One-off verification script — not part of the app. Exercises Expert
// Network end-to-end against the live Supabase project:
//   1. Expert creates a profile with a credential document (not publicly
//      listed yet)
//   2. Confirms it's NOT in the public directory pre-verification
//   3. Admin (a real profiles.role='admin' account, set directly since
//      there's no self-registration path) sees it in the pending queue
//      and approves it
//   4. Confirms it NOW appears in the public directory
//   5. A client with a referral_suggested=true BraidCare session refers
//      themselves to the expert with consent
//   6. Confirms the expert CAN read that session's flags via the existing
//      GET /api/braidcare/sessions/:id (RLS extension actually works)
//   7. Confirms a DIFFERENT, unrelated expert CANNOT read it
//   8. Admin marks the referral completed with a fee, confirms it recorded
//   9. Cleans up every row, every uploaded object, and the admin flag
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

const ids = {
  expertUserId: null,
  expertProfileId: null,
  otherExpertUserId: null,
  otherExpertProfileId: null,
  adminUserId: null,
  clientId: null,
  braiderUserId: null,
  braiderProfileId: null,
  serviceId: null,
  bookingId: null,
  sessionId: null,
  referralId: null,
};

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

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

  console.log("1. Creating test expert, second expert, admin, client, braider...");
  const makeUser = async (label, role) => {
    const { data } = await admin.auth.admin.createUser({
      email: `smoketest-exp-${label}-${suffix}@braidr.internal.test`,
      password: "correct-horse-battery-staple",
      email_confirm: true,
      user_metadata: { role, full_name: `Expert Smoke Test ${label}` },
    });
    return data.user;
  };

  const expertUser = await makeUser("primary", "expert");
  const otherExpertUser = await makeUser("other", "expert");
  const adminUser = await makeUser("admin-acct", "client"); // created as client, then flipped to admin below
  const clientUser = await makeUser("client", "client");
  const braiderUser = await makeUser("braider", "braider");
  ids.expertUserId = expertUser.id;
  ids.otherExpertUserId = otherExpertUser.id;
  ids.adminUserId = adminUser.id;
  ids.clientId = clientUser.id;
  ids.braiderUserId = braiderUser.id;

  // No self-registration path for admin (by design) — set directly, the
  // same way Harrison will need to for a real admin account.
  await admin.from("profiles").update({ role: "admin" }).eq("id", ids.adminUserId);
  console.log("   OK");

  console.log("2. Expert creates a profile with a credential document...");
  const expertJar = await loginAs(expertUser.email);
  const createFormData = new FormData();
  createFormData.append("credentials", "MBChB, MRCP(Derm)");
  createFormData.append("city", "London");
  createFormData.append("specialisation", "traction alopecia,CCCA");
  createFormData.append(
    "credential_document",
    new Blob([Buffer.from("fake credential pdf")], { type: "application/pdf" }),
    "credentials.pdf"
  );
  const createRes = await authedFetch(expertJar, `${BASE_URL}/api/experts`, {
    method: "POST",
    body: createFormData,
  });
  const createBody = await createRes.json();
  assert(createRes.status === 201, `expert creation failed: ${JSON.stringify(createBody)}`);
  ids.expertProfileId = createBody.data.expert_id;
  console.log("   OK — expert_id:", ids.expertProfileId, "status:", createBody.data.status);

  console.log("3. Confirming the expert is NOT in the public directory yet...");
  const preVerifyList = await authedFetch(expertJar, `${BASE_URL}/api/experts?specialisation=CCCA`);
  const preVerifyBody = await preVerifyList.json();
  assert(
    !preVerifyBody.data.experts.some((e) => e.id === ids.expertProfileId),
    "unverified expert should not appear in the public directory"
  );
  console.log("   OK — correctly unlisted pre-verification");

  console.log("4. Admin sees it in the pending queue and approves it...");
  const adminJar = await loginAs(adminUser.email);
  const pendingRes = await authedFetch(adminJar, `${BASE_URL}/api/admin/experts/pending`);
  const pendingBody = await pendingRes.json();
  assert(pendingRes.status === 200, `pending fetch failed: ${JSON.stringify(pendingBody)}`);
  assert(
    pendingBody.data.pending.some((e) => e.id === ids.expertProfileId),
    "expert should be in the pending queue"
  );
  const verifyRes = await authedFetch(
    adminJar,
    `${BASE_URL}/api/admin/experts/${ids.expertProfileId}/verify`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true, note: "Credentials checked, looks good." }),
    }
  );
  assert(verifyRes.status === 200, `verify failed: ${JSON.stringify(await verifyRes.json())}`);
  console.log("   OK — approved");

  console.log("5. Confirming a non-admin CANNOT verify an expert...");
  const clientJarForVerifyCheck = await loginAs(clientUser.email);
  const forbiddenVerifyRes = await authedFetch(
    clientJarForVerifyCheck,
    `${BASE_URL}/api/admin/experts/${ids.expertProfileId}/verify`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve: true }),
    }
  );
  assert(forbiddenVerifyRes.status === 403, `expected 403, got ${forbiddenVerifyRes.status}`);
  console.log("   OK — non-admin correctly forbidden");

  console.log("6. Confirming the expert NOW appears in the public directory...");
  const postVerifyList = await authedFetch(
    expertJar,
    `${BASE_URL}/api/experts?specialisation=CCCA`
  );
  const postVerifyBody = await postVerifyList.json();
  assert(
    postVerifyBody.data.experts.some((e) => e.id === ids.expertProfileId),
    "verified expert should now appear in the public directory"
  );
  console.log("   OK — now listed");

  console.log(
    "7. Setting up a client + braider + confirmed booking + flagged BraidCare session..."
  );
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
  const { data: service } = await admin
    .from("services")
    .insert({
      braider_id: ids.braiderProfileId,
      name: "Expert Network Smoke Test Service",
      category: "braids",
      price_from: 8000,
      duration_mins: 60,
    })
    .select("id")
    .single();
  ids.serviceId = service.id;
  const { data: booking } = await admin
    .from("bookings")
    .insert({
      client_id: ids.clientId,
      braider_id: ids.braiderProfileId,
      service_id: ids.serviceId,
      appointment_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      amount_pence: 8000,
      commission_pence: 960,
      braider_payout_pence: 7040,
      status: "confirmed",
    })
    .select("id")
    .single();
  ids.bookingId = booking.id;
  const { data: session } = await admin
    .from("braidcare_sessions")
    .insert({
      booking_id: ids.bookingId,
      client_id: ids.clientId,
      session_number: 1,
      session_type: "included",
    })
    .select("id")
    .single();
  ids.sessionId = session.id;
  // Simulating what /analyse would have written — this test is about the
  // referral/consent flow, not re-testing the AI pipeline (already covered
  // by smoke-test-braidcare.mjs).
  await admin
    .from("braidcare_sessions")
    .update({
      status: "completed",
      overall_status: "seek_specialist",
      summary: "Signs of significant tension at the frontal hairline.",
      condition_flags: [
        {
          area: "frontal hairline",
          observation: "marked tension",
          severity: "high",
          action: "see a specialist",
        },
      ],
      referral_suggested: true,
      referral_threshold_met: "High severity flag",
      report_delivered_at: new Date().toISOString(),
    })
    .eq("id", ids.sessionId);
  console.log("   OK");

  console.log("8. Client refers themselves to the expert with consent...");
  const clientJar = await loginAs(clientUser.email);
  const referralRes = await authedFetch(clientJar, `${BASE_URL}/api/experts/referrals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expert_id: ids.expertProfileId,
      braidcare_session_id: ids.sessionId,
      consent_given: true,
    }),
  });
  const referralBody = await referralRes.json();
  assert(referralRes.status === 201, `referral failed: ${JSON.stringify(referralBody)}`);
  ids.referralId = referralBody.data.referral_id;
  console.log("   OK — referral_id:", ids.referralId);

  console.log("9. Confirming the referred expert CAN read the session's flags (never photos)...");
  const sessionForExpertRes = await authedFetch(
    expertJar,
    `${BASE_URL}/api/braidcare/sessions/${ids.sessionId}`
  );
  const sessionForExpertBody = await sessionForExpertRes.json();
  assert(
    sessionForExpertRes.status === 200,
    `expert session read failed: ${JSON.stringify(sessionForExpertBody)}`
  );
  assert(
    sessionForExpertBody.data.session.overall_status === "seek_specialist",
    "expert should see overall_status"
  );
  assert(
    sessionForExpertBody.data.session.photo_paths === undefined,
    "expert must never see photo_paths"
  );
  console.log("   OK — flags visible, photos absent from the response entirely");

  console.log("10. Confirming an UNRELATED expert CANNOT read the same session...");
  const otherExpertJar = await loginAs(otherExpertUser.email);
  const otherReadRes = await authedFetch(
    otherExpertJar,
    `${BASE_URL}/api/braidcare/sessions/${ids.sessionId}`
  );
  const otherReadBody = await otherReadRes.json();
  assert(
    otherReadRes.status === 404,
    `expected 404 for unrelated expert, got ${otherReadRes.status}: ${JSON.stringify(otherReadBody)}`
  );
  console.log("   OK — correctly denied (RLS returns 0 rows, surfaced as 404)");

  console.log("11. Admin marks the referral completed with a fee...");
  const completeRes = await authedFetch(
    adminJar,
    `${BASE_URL}/api/experts/referrals/${ids.referralId}/complete`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referral_fee_pence: 2000 }),
    }
  );
  assert(
    completeRes.status === 200,
    `complete failed: ${JSON.stringify(await completeRes.json())}`
  );

  const adminReferralsRes = await authedFetch(adminJar, `${BASE_URL}/api/experts/referrals`);
  const adminReferralsBody = await adminReferralsRes.json();
  const completedReferral = adminReferralsBody.data.referrals.find((r) => r.id === ids.referralId);
  assert(completedReferral?.status === "completed", "referral should be marked completed");
  assert(completedReferral?.referral_fee_pence === 2000, "fee should be recorded as 2000 pence");
  console.log("   OK — referral completed, £20.00 fee recorded");

  console.log("12. Confirming referral_count incremented on the expert profile...");
  const { data: finalExpertProfile } = await admin
    .from("expert_profiles")
    .select("referral_count")
    .eq("id", ids.expertProfileId)
    .single();
  assert(
    finalExpertProfile.referral_count === 1,
    `expected referral_count 1, got ${finalExpertProfile.referral_count}`
  );
  console.log("   OK");

  console.log("\nAll checks passed — Expert Network works end-to-end against real Supabase.");
} finally {
  console.log("\nCleaning up (FK-safe order)...");
  if (ids.referralId) await admin.from("expert_referrals").delete().eq("id", ids.referralId);
  if (ids.sessionId) await admin.from("braidcare_sessions").delete().eq("id", ids.sessionId);
  if (ids.bookingId) await admin.from("bookings").delete().eq("id", ids.bookingId);
  if (ids.serviceId) await admin.from("services").delete().eq("id", ids.serviceId);
  if (ids.braiderProfileId)
    await admin.from("braider_profiles").delete().eq("id", ids.braiderProfileId);
  for (const expertProfileId of [ids.expertProfileId, ids.otherExpertProfileId]) {
    if (!expertProfileId) continue;
    const { data: ep } = await admin
      .from("expert_profiles")
      .select("credential_doc_path")
      .eq("id", expertProfileId)
      .single();
    if (ep?.credential_doc_path)
      await admin.storage.from("expert-credentials").remove([ep.credential_doc_path]);
    await admin.from("expert_profiles").delete().eq("id", expertProfileId);
  }
  for (const userId of [
    ids.expertUserId,
    ids.otherExpertUserId,
    ids.adminUserId,
    ids.clientId,
    ids.braiderUserId,
  ]) {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
  console.log("Done.");
}
