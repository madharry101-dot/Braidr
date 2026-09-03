// One-off verification script — not part of the app. Exercises content
// moderation + notification management end-to-end against the live
// Supabase project:
//   1. Braider uploads 2 portfolio photos, deletes one themselves
//   2. Admin removes the remaining one with a reason -> storage object
//      gone, braider_portfolio_photos row gone, moderation log entry
//      recorded
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

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
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

// Portfolio photos are rows in braider_portfolio_photos, not a text[] on
// braider_profiles, so there is no photo list on any response body to
// assert against any more — every route returns only what it did
// (`{ added }`, `{ deleted }`, `{ removed_path }`). Read the real state
// out of the database instead, ordered the way the admin route indexes it.
async function listPortfolioRows() {
  const { data, error } = await admin
    .from("braider_portfolio_photos")
    .select("id, storage_path, sort_order")
    .eq("braider_id", ids.braiderProfileId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`could not read braider_portfolio_photos: ${error.message}`);
  return data ?? [];
}
async function listPortfolioObjects() {
  const { data } = await admin.storage.from("portfolio-photos").list(ids.braiderUserId);
  return (data ?? []).map((o) => `${ids.braiderUserId}/${o.name}`);
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
    // is_active: false so a stranded profile cannot reach the public
    // directory. braider_profiles.is_active defaults to TRUE, and on
    // 2026-08-31 a failed teardown left one listed publicly for three days.
    // Nothing in this script reads the braider as another user or through
    // public_profiles, so hiding it costs the test nothing.
    .insert({ user_id: ids.braiderUserId, city: "London", is_active: false })
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
  assert(uploadBody.data.added === 2, `should have added 2 photos: ${JSON.stringify(uploadBody)}`);

  const afterUpload = await listPortfolioRows();
  assert(afterUpload.length === 2, `should have 2 photo rows, got ${afterUpload.length}`);
  assert(
    (await listPortfolioObjects()).length === 2,
    "both uploads should exist as real storage objects"
  );

  // The owner route deletes by row id now, not by array index.
  const selfDeleted = afterUpload[1];
  const ownDeleteRes = await authedFetch(
    braiderJar,
    `${BASE_URL}/api/braiders/${ids.braiderProfileId}/portfolio-photos/${selfDeleted.id}`,
    {
      method: "DELETE",
    }
  );
  const ownDeleteBody = await ownDeleteRes.json();
  assert(ownDeleteRes.status === 200, `own-delete failed: ${JSON.stringify(ownDeleteBody)}`);
  assert(ownDeleteBody.data.deleted === true, "own-delete should report deleted: true");

  const afterSelfDelete = await listPortfolioRows();
  assert(
    afterSelfDelete.length === 1 && afterSelfDelete[0].id !== selfDeleted.id,
    "exactly the photo the owner deleted should be gone"
  );
  const objectsAfterSelfDelete = await listPortfolioObjects();
  assert(
    !objectsAfterSelfDelete.includes(selfDeleted.storage_path),
    "the self-deleted storage object should actually be gone, not just untracked"
  );
  console.log("   OK — owner upload + self-delete both work (row and object removed)");

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
  // Index 0 is a position into the braider's photos ordered by sort_order —
  // after the self-delete above there is one left, and it is that one.
  assert(
    modDeleteBody.data.removed_path === afterSelfDelete[0].storage_path,
    `admin should have removed the surviving photo, got ${modDeleteBody.data.removed_path}`
  );

  assert((await listPortfolioRows()).length === 0, "should have 0 photo rows left");
  assert(
    (await listPortfolioObjects()).length === 0,
    "the storage object should actually be gone, not just untracked"
  );
  console.log("   OK — row removed AND storage object actually deleted");

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

  console.log("9. Empty segment ({}) is treated as platform-wide...");
  // The header has always claimed this check; it was never actually
  // written. An empty segment matches EVERY user, so with a live Resend
  // key this step would email the whole platform — refuse to run it rather
  // than spam real inboxes. RESEND_API_KEY is empty in dev, where
  // sendEmail() logs instead of sending.
  if (env.RESEND_API_KEY) {
    console.log("   SKIPPED — RESEND_API_KEY is set; refusing to email every user.");
  } else {
    const platformRes = await authedFetch(adminJar, `${BASE_URL}/api/admin/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segment: {},
        subject: "Smoke test platform-wide announcement",
        message: "This is a platform-wide announcement smoke test.",
      }),
    });
    const platformBody = await platformRes.json();
    assert(
      platformRes.status === 201,
      `platform-wide announcement failed: ${JSON.stringify(platformBody)}`
    );
    // Both test users created here are in it, and an unfiltered segment can
    // never match fewer people than the role-filtered one above.
    assert(
      platformBody.data.recipient_count >= 2,
      "platform-wide should reach at least both test users"
    );
    assert(
      platformBody.data.recipient_count >= announceBody.data.recipient_count,
      `platform-wide (${platformBody.data.recipient_count}) should not be narrower than role-targeted (${announceBody.data.recipient_count})`
    );
    console.log("   OK — recipient_count:", platformBody.data.recipient_count);
  }

  console.log("10. Confirming a non-admin CANNOT send announcements...");
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
  // Deleting the profile cascades braider_portfolio_photos but NOT the
  // objects those rows pointed at, and portfolio-photos is a PUBLIC bucket
  // — so a run that fails between upload and removal would otherwise leave
  // real images sitting at stable unauthenticated URLs.
  if (ids.braiderUserId) {
    const { data: leftovers } = await admin.storage
      .from("portfolio-photos")
      .list(ids.braiderUserId);
    if (leftovers?.length) {
      await admin.storage
        .from("portfolio-photos")
        .remove(leftovers.map((o) => `${ids.braiderUserId}/${o.name}`));
    }
  }
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
