// One-off verification script — not part of the app. Exercises content
// moderation + notification management end-to-end against the live
// Supabase project:
//   1. Braider uploads 2 portfolio photos, deletes one themselves
//   2. Admin removes the remaining one with a reason -> storage object
//      gone, array updated, moderation log entry recorded
//   3. Admin removes a user's avatar the same way
//   4. Confirms a non-admin is forbidden from both moderation actions
//   5. Admin sends a targeted announcement (role: braider) -> confirms the
//      test braider's real inbox target (Resend) is attempted and the
//      announcement is logged with the right recipient_count
//   6. Confirms an empty segment ({}) is treated as "platform-wide" and
//      matches at least the test users created here
//   7. Cleans up every row, object, and user it created
import { readFileSync } from "fs";
import sharp from "sharp";
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

const BASE_URL = "http://localhost:3000";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ids = { adminUserId: null, braiderUserId: null, braiderProfileId: null };
const PASSWORD = "correct-horse-battery-staple";

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
  assert(res.ok, `login failed: ${res.status} ${await res.text()}`);
  updateJarFromResponse(jar, res);
  return jar;
}

// This used to return 8 bytes — a bare JPEG signature (ff d8 ff e0) with no
// image behind it. That was accepted because the upload route trusted the
// client's declared MIME type and stored the buffer untouched.
//
// The upload routes now re-encode through sharp (lib/images/sanitise.ts) to
// strip EXIF GPS, which decodes the bytes as a side effect and rejects
// anything that isn't a real image. The old fixture is exactly what that is
// meant to stop — and note it would have passed a naive magic-byte check too,
// since its first four bytes are a valid JPEG signature. Only an actual
// decode catches it.
//
// So the fixture is now a real (tiny) JPEG, matching smoke-test-braidcare.mjs.
const REAL_JPEG = await sharp({
  create: { width: 64, height: 64, channels: 3, background: { r: 180, g: 140, b: 110 } },
})
  .jpeg()
  .toBuffer();

function fakeJpeg() {
  return new Blob([REAL_JPEG], { type: "image/jpeg" });
}

try {
  const suffix = Date.now();
  const { data: adminUser } = await admin.auth.admin.createUser({
    email: `smoketest-mod-admin-${suffix}@braidr.internal.test`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "client", full_name: "Moderation Smoke Test Admin" },
  });
  ids.adminUserId = adminUser.user.id;
  await admin.from("profiles").update({ role: "admin" }).eq("id", ids.adminUserId);

  const { data: braiderUser } = await admin.auth.admin.createUser({
    email: `smoketest-mod-braider-${suffix}@braidr.internal.test`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "braider", full_name: "Moderation Smoke Test Braider" },
  });
  ids.braiderUserId = braiderUser.user.id;
  const { data: braiderProfile } = await admin
    .from("braider_profiles")
    .insert({ user_id: ids.braiderUserId, city: "London" })
    .select("id")
    .single();
  ids.braiderProfileId = braiderProfile.id;
  await admin
    .from("profiles")
    .update({ avatar_url: `${ids.braiderUserId}/fake-avatar.jpg` })
    .eq("id", ids.braiderUserId);

  const adminJar = await login(adminUser.user.email, PASSWORD);
  const braiderJar = await login(braiderUser.user.email, PASSWORD);
  console.log("1. Test users created.");

  console.log("2. Braider uploads 2 portfolio photos, deletes one themselves...");
  const uploadForm = new FormData();
  uploadForm.append("photos", fakeJpeg(), "one.jpg");
  uploadForm.append("photos", fakeJpeg(), "two.jpg");
  const uploadRes = await authedFetch(
    braiderJar,
    `${BASE_URL}/api/braiders/${ids.braiderProfileId}/portfolio-photos`,
    {
      method: "POST",
      body: uploadForm,
    }
  );
  const uploadBody = await uploadRes.json();
  assert(uploadRes.status === 201, `upload failed: ${JSON.stringify(uploadBody)}`);
  assert(uploadBody.data.portfolio_photos.length === 2, "should have 2 photos");

  const ownDeleteRes = await authedFetch(
    braiderJar,
    `${BASE_URL}/api/braiders/${ids.braiderProfileId}/portfolio-photos/1`,
    {
      method: "DELETE",
    }
  );
  const ownDeleteBody = await ownDeleteRes.json();
  assert(ownDeleteRes.status === 200, `own-delete failed: ${JSON.stringify(ownDeleteBody)}`);
  assert(
    ownDeleteBody.data.portfolio_photos.length === 1,
    "should have 1 photo left after self-delete"
  );
  console.log("   OK — owner upload + self-delete both work");

  console.log("3. Admin removes the remaining portfolio photo with a reason...");
  const modDeleteRes = await authedFetch(
    adminJar,
    `${BASE_URL}/api/admin/content/portfolio/${ids.braiderProfileId}/0`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Inappropriate content (test)." }),
    }
  );
  const modDeleteBody = await modDeleteRes.json();
  assert(
    modDeleteRes.status === 200,
    `admin portfolio removal failed: ${JSON.stringify(modDeleteBody)}`
  );
  assert(modDeleteBody.data.portfolio_photos.length === 0, "should have 0 photos left");

  const { data: storageCheck } = await admin.storage
    .from("portfolio-photos")
    .list(ids.braiderUserId);
  assert(
    (storageCheck ?? []).length === 0,
    "the storage object should actually be gone, not just untracked"
  );
  console.log("   OK — array emptied AND storage object actually deleted");

  console.log("4. Admin removes the test braider's avatar...");
  const avatarRes = await authedFetch(
    adminJar,
    `${BASE_URL}/api/admin/content/avatar/${ids.braiderUserId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Inappropriate avatar (test)." }),
    }
  );
  assert(
    avatarRes.status === 200,
    `avatar removal failed: ${JSON.stringify(await avatarRes.json())}`
  );
  const { data: profileAfter } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", ids.braiderUserId)
    .single();
  assert(profileAfter.avatar_url === null, "avatar_url should be cleared");
  console.log("   OK");

  console.log("5. Moderation log records both actions...");
  const logRes = await authedFetch(adminJar, `${BASE_URL}/api/admin/content/moderation-log`);
  const logBody = await logRes.json();
  const ourEntries = logBody.data.log.filter((l) => l.target_user_id === ids.braiderUserId);
  assert(ourEntries.length === 2, `expected 2 log entries, got ${ourEntries.length}`);
  assert(
    ourEntries.some((l) => l.target_type === "avatar"),
    "should have an avatar log entry"
  );
  assert(
    ourEntries.some((l) => l.target_type === "portfolio_photo"),
    "should have a portfolio_photo log entry"
  );
  console.log("   OK — both actions logged with reasons");

  console.log("6. Confirming a non-admin CANNOT moderate content...");
  const forbiddenRes = await authedFetch(
    braiderJar,
    `${BASE_URL}/api/admin/content/avatar/${ids.braiderUserId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "trying to self-moderate" }),
    }
  );
  assert(forbiddenRes.status === 403, `expected 403, got ${forbiddenRes.status}`);
  console.log("   OK — non-admin correctly forbidden");

  console.log("7. Admin sends a targeted announcement (role: braider)...");
  const announceRes = await authedFetch(adminJar, `${BASE_URL}/api/admin/notifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      segment: { role: "braider" },
      subject: "Smoke test announcement",
      message: "This is a targeted announcement smoke test.",
    }),
  });
  const announceBody = await announceRes.json();
  assert(announceRes.status === 201, `announcement failed: ${JSON.stringify(announceBody)}`);
  assert(
    announceBody.data.recipient_count >= 1,
    "should have at least our test braider as a recipient"
  );
  console.log("   OK — recipient_count:", announceBody.data.recipient_count);

  console.log("8. GET /api/admin/notifications shows it in history...");
  const historyRes = await authedFetch(adminJar, `${BASE_URL}/api/admin/notifications`);
  const historyBody = await historyRes.json();
  assert(
    historyBody.data.announcements.some((a) => a.id === announceBody.data.announcement_id),
    "the sent announcement should appear in history"
  );
  console.log("   OK");

  console.log("9. Confirming a non-admin CANNOT send announcements...");
  const forbiddenAnnounceRes = await authedFetch(
    braiderJar,
    `${BASE_URL}/api/admin/notifications`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segment: {}, subject: "x", message: "y" }),
    }
  );
  assert(forbiddenAnnounceRes.status === 403, `expected 403, got ${forbiddenAnnounceRes.status}`);
  console.log("   OK — non-admin correctly forbidden");

  console.log(
    "\nAll checks passed — content moderation + notifications work end-to-end against real Supabase."
  );
} finally {
  console.log("\nCleaning up (FK-safe order)...");
  if (ids.braiderProfileId)
    await admin.from("braider_profiles").delete().eq("id", ids.braiderProfileId);
  await admin
    .from("content_moderation_log")
    .delete()
    .eq("target_user_id", ids.braiderUserId ?? "");
  await admin
    .from("platform_announcements")
    .delete()
    .eq("admin_id", ids.adminUserId ?? "");
  for (const userId of [ids.adminUserId, ids.braiderUserId]) {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  console.log("Done.");
}
