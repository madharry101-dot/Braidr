// Verification script for R-02 — not part of the app.
//
// Proves, end to end through the real HTTP route and the real bucket, that an
// uploaded photograph is stripped of EXIF before it is stored. This is the
// guard on a privacy promise: Privacy Policy §4.2 tells users "EXIF metadata
// (which can include GPS location) is stripped from every photograph before
// storage", and portfolio photos land in a PUBLIC bucket at a stable
// unauthenticated URL — a braider's EXIF is their home address.
//
// Checks:
//   1. A JPEG carrying EXIF (device tag + orientation) uploads successfully
//   2. The object actually stored in the bucket has NO EXIF block
//   3. EXIF orientation was applied to the pixels before being discarded
//      (otherwise every portrait phone photo would display sideways)
//   4. A non-image whose first bytes are a valid JPEG signature is REJECTED
//      (the old fixture: a naive magic-byte check would have passed it)
//   5. Cleans up every row, object and user it created
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

const PASSWORD = "correct-horse-battery-staple";
const ids = { braiderUserId: null, braiderProfileId: null };

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function jarHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function updateJar(jar, res) {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return;
  for (const part of setCookie.split(/,(?=[^;]+?=[^;]+?)/)) {
    const [nv] = part.split(";");
    const eq = nv.indexOf("=");
    if (eq !== -1) jar.set(nv.slice(0, eq).trim(), nv.slice(eq + 1).trim());
  }
}

try {
  const suffix = Date.now();
  const { data: braiderUser } = await admin.auth.admin.createUser({
    email: `smoketest-exif-${suffix}@braidr.internal.test`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "braider", full_name: "EXIF Smoke Test Braider" },
  });
  ids.braiderUserId = braiderUser.user.id;
  const { data: profile } = await admin
    .from("braider_profiles")
    .insert({ user_id: ids.braiderUserId, city: "London" })
    .select("id")
    .single();
  ids.braiderProfileId = profile.id;

  const jar = new Map();
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: braiderUser.user.email, password: PASSWORD }),
  });
  assert(loginRes.ok, `login failed: ${loginRes.status} ${await loginRes.text()}`);
  updateJar(jar, loginRes);
  console.log("1. Test braider created and signed in.");

  // 1200x800 landscape tagged orientation=6 — exactly what a phone writes for
  // a photo taken in portrait — plus an identifying device tag we can search
  // for in the stored bytes.
  console.log("2. Building a JPEG that carries EXIF...");
  const withExif = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 90, g: 60, b: 40 } },
  })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: { IFD0: { Make: "BraidrExifProbe", Model: "R02" } },
    })
    .toBuffer();

  const before = await sharp(withExif).metadata();
  assert(before.exif, "fixture should carry an EXIF block");
  assert(before.orientation === 6, "fixture should carry orientation=6");
  console.log(
    `   fixture: ${before.width}x${before.height}, EXIF ${before.exif.length} bytes, orientation ${before.orientation}`
  );

  console.log("3. Uploading it through the real portfolio-photos route...");
  const form = new FormData();
  form.append("photos", new Blob([withExif], { type: "image/jpeg" }), "exif-probe.jpg");
  const uploadRes = await fetch(
    `${BASE_URL}/api/braiders/${ids.braiderProfileId}/portfolio-photos`,
    { method: "POST", body: form, headers: { Cookie: jarHeader(jar) } }
  );
  const uploadBody = await uploadRes.json();
  assert(uploadRes.status === 201, `upload failed: ${JSON.stringify(uploadBody)}`);
  console.log("   OK — uploaded");

  console.log("4. Reading the object back out of the bucket...");
  const { data: rows } = await admin
    .from("braider_portfolio_photos")
    .select("storage_path")
    .eq("braider_id", ids.braiderProfileId);
  assert(rows.length === 1, `expected 1 stored photo, got ${rows.length}`);

  const { data: blob, error: dlErr } = await admin.storage
    .from("portfolio-photos")
    .download(rows[0].storage_path);
  assert(!dlErr, `download failed: ${dlErr?.message}`);
  const stored = Buffer.from(await blob.arrayBuffer());
  const after = await sharp(stored).metadata();

  const exifText = after.exif ? after.exif.toString("latin1") : "";
  assert(!after.exif, `stored object still carries an EXIF block (${after.exif?.length} bytes)`);
  assert(!exifText.includes("BraidrExifProbe"), "device tag survived into storage");
  assert(
    !stored.includes(Buffer.from("BraidrExifProbe")),
    "device tag present in raw stored bytes"
  );
  console.log("   OK — stored object has NO EXIF block, device tag gone");

  assert(
    after.width === 800 && after.height === 1200,
    `orientation should be baked into pixels (expected 800x1200, got ${after.width}x${after.height})`
  );
  console.log("   OK — orientation applied to pixels before EXIF was dropped (800x1200)");

  // The old smoke-test fixture: a valid JPEG signature with no image behind
  // it. A magic-byte check would pass this; only a real decode rejects it.
  console.log("5. A fake JPEG (valid signature, no image) must be rejected...");
  const fakeForm = new FormData();
  fakeForm.append(
    "photos",
    new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])], { type: "image/jpeg" }),
    "fake.jpg"
  );
  const fakeRes = await fetch(`${BASE_URL}/api/braiders/${ids.braiderProfileId}/portfolio-photos`, {
    method: "POST",
    body: fakeForm,
    headers: { Cookie: jarHeader(jar) },
  });
  assert(fakeRes.status === 422, `expected 422 for a non-image, got ${fakeRes.status}`);
  console.log("   OK — rejected with 422");

  console.log("\nAll checks passed — uploads are EXIF-stripped and type-verified at the door.");
} finally {
  console.log("\nCleaning up...");
  if (ids.braiderProfileId) {
    const { data: rows } = await admin
      .from("braider_portfolio_photos")
      .select("storage_path")
      .eq("braider_id", ids.braiderProfileId);
    for (const r of rows ?? []) {
      await admin.storage.from("portfolio-photos").remove([r.storage_path]);
    }
    await admin.from("braider_portfolio_photos").delete().eq("braider_id", ids.braiderProfileId);
    await admin.from("braider_profiles").delete().eq("id", ids.braiderProfileId);
  }
  if (ids.braiderUserId) await admin.auth.admin.deleteUser(ids.braiderUserId);
  console.log("Done.");
}
