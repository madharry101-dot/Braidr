// Proves the profiles PII exposure is closed, and that nothing that
// legitimately needs a name lost access.
//
// Run it BEFORE applying 20260911000001 to see the leak, and AFTER to see
// it closed — the "LEAK" checks are expected to fail beforehand.
//
//   node scripts/smoke-test-profile-exposure.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

globalThis.WebSocket ??= WebSocket;

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^["']|["']$/g, ""),
      ];
    })
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log("  OK   —", msg);
  else {
    console.error("  FAIL —", msg);
    failures++;
  }
};

const suffix = Date.now();
const PW = "correct-horse-battery-staple";
const ids = {
  braiderUserId: null,
  braiderProfileId: null,
  snooperId: null,
  clientId: null,
  bookingId: null,
  serviceId: null,
};

const SECRETS = ["phone", "date_of_birth", "stripe_customer_id", "referral_code"];

try {
  // A braider with PII filled in — the person whose data was leaking.
  const { data: b } = await admin.auth.admin.createUser({
    email: `pe-braider-${suffix}@braidr.internal.test`,
    password: PW,
    email_confirm: true,
    user_metadata: { role: "braider", full_name: "PE Braider" },
  });
  ids.braiderUserId = b.user.id;
  await admin
    .from("profiles")
    .update({ phone: "07700900123", date_of_birth: "1990-01-01", display_name: "Ama B." })
    .eq("id", ids.braiderUserId);
  await admin
    .from("profiles")
    .update({ stripe_customer_id: "cus_PE_SECRET" })
    .eq("id", ids.braiderUserId);

  const { data: bp } = await admin
    .from("braider_profiles")
    .insert({ user_id: ids.braiderUserId, city: "London" })
    .select("id")
    .single();
  ids.braiderProfileId = bp.id;

  // An unrelated signed-in user — no booking, no relationship at all.
  const { data: s } = await admin.auth.admin.createUser({
    email: `pe-snooper-${suffix}@braidr.internal.test`,
    password: PW,
    email_confirm: true,
    user_metadata: { role: "client", full_name: "PE Snooper" },
  });
  ids.snooperId = s.user.id;

  console.log("Set up a braider with PII, and an unrelated signed-in user.\n");

  // ── the leak ──────────────────────────────────────────────────────────
  console.log("1. An unrelated signed-in user attacks the braider's profile row");
  const asSnooper = createClient(URL_, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await asSnooper.auth.signInWithPassword({
    email: `pe-snooper-${suffix}@braidr.internal.test`,
    password: PW,
  });

  for (const col of SECRETS) {
    const { data } = await asSnooper.from("profiles").select(col).eq("id", ids.braiderUserId);
    const got = data?.[0]?.[col];
    ok(!data || data.length === 0 || got == null, `cannot read the braider's ${col}`);
  }
  const { data: wholeRow } = await asSnooper
    .from("profiles")
    .select("*")
    .eq("id", ids.braiderUserId);
  ok((wholeRow ?? []).length === 0, "cannot select the braider's profiles row at all");

  console.log("\n2. Anonymous (no account at all)");
  const anon = createClient(URL_, ANON);
  const { data: anonRow } = await anon.from("profiles").select("*").eq("id", ids.braiderUserId);
  ok((anonRow ?? []).length === 0, "anonymous cannot read any profiles row");

  // ── what must still work ──────────────────────────────────────────────
  console.log("\n3. The public view still serves what the product needs");
  const { data: pub } = await asSnooper
    .from("public_profiles")
    .select("*")
    .eq("id", ids.braiderUserId)
    .maybeSingle();
  ok(pub?.name === "Ama B.", "the braider's display name IS public");
  ok(pub !== null && "avatar_url" in pub, "avatar_url is exposed");
  for (const col of SECRETS) {
    ok(!(col in (pub ?? {})), `the view does NOT carry ${col}`);
  }

  const { data: anonPub } = await anon
    .from("public_profiles")
    .select("id, name")
    .eq("id", ids.braiderUserId)
    .maybeSingle();
  ok(
    anonPub?.name === "Ama B.",
    "anonymous can read the public view (search must work logged out)"
  );

  console.log("\n4. Owner access is untouched");
  const asBraider = createClient(URL_, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await asBraider.auth.signInWithPassword({
    email: `pe-braider-${suffix}@braidr.internal.test`,
    password: PW,
  });
  const { data: own } = await asBraider
    .from("profiles")
    .select("phone, referral_code, date_of_birth")
    .eq("id", ids.braiderUserId)
    .maybeSingle();
  ok(own?.phone === "07700900123", "the braider can still read their OWN phone");
  ok(Boolean(own?.referral_code), "the braider can still read their OWN referral code");

  console.log("\n5. A braider's view of a booked client (braider_client_profiles)");
  const { data: c } = await admin.auth.admin.createUser({
    email: `pe-client-${suffix}@braidr.internal.test`,
    password: PW,
    email_confirm: true,
    user_metadata: { role: "client", full_name: "PE Client" },
  });
  ids.clientId = c.user.id;
  await admin
    .from("profiles")
    .update({ phone: "07700900999", date_of_birth: "1995-05-05", hair_type: "curly" })
    .eq("id", ids.clientId);
  await admin
    .from("profiles")
    .update({ stripe_customer_id: "cus_CLIENT_SECRET" })
    .eq("id", ids.clientId);

  const { data: svc } = await admin
    .from("services")
    .insert({
      braider_id: bp.id,
      name: "PE Braids",
      category: "braids",
      price_from: 5000,
      duration_mins: 60,
    })
    .select("id")
    .single();
  ids.serviceId = svc.id;
  const { data: bk } = await admin
    .from("bookings")
    .insert({
      client_id: ids.clientId,
      braider_id: bp.id,
      service_id: svc.id,
      appointment_at: new Date(Date.now() + 86400000).toISOString(),
      amount_pence: 5000,
      commission_pence: 600,
      braider_payout_pence: 4400,
      status: "confirmed",
    })
    .select("id")
    .single();
  ids.bookingId = bk.id;

  // The old policy is gone: a braider can no longer touch the client's
  // profiles row directly.
  const { data: baseRow } = await asBraider
    .from("profiles")
    .select("full_name")
    .eq("id", ids.clientId)
    .maybeSingle();
  ok(!baseRow, "a braider can NO LONGER read a client's profiles row directly");

  const { data: strangerBase } = await asSnooper
    .from("profiles")
    .select("full_name")
    .eq("id", ids.clientId)
    .maybeSingle();
  ok(!strangerBase, "an unrelated user still cannot read that client's row");

  // The view: name + phone yes, secrets no.
  const { data: view } = await asBraider
    .from("braider_client_profiles")
    .select("*")
    .eq("id", ids.clientId)
    .maybeSingle();
  ok(view?.name === "PE Client", "the braider CAN see the client's name via the view");
  ok(view?.phone === "07700900999", "the braider CAN see the client's phone via the view");
  for (const col of ["stripe_customer_id", "referral_code", "date_of_birth"]) {
    ok(!(col in (view ?? {})), `the view does NOT carry ${col}`);
  }
  ok(
    "hair_type" in (view ?? {}) && view.hair_type === null,
    "a client's SELF-reported hair type is not shared (null until a braider confirms)"
  );

  // Confirm the hair type as this braider, then re-read.
  await admin
    .from("profiles")
    .update({
      hair_type: "coily",
      hair_type_source: "braider_confirmed",
      hair_type_confirmed_by: ids.braiderUserId,
      hair_type_confirmed_at: new Date().toISOString(),
    })
    .eq("id", ids.clientId);
  const { data: view2 } = await asBraider
    .from("braider_client_profiles")
    .select("hair_type")
    .eq("id", ids.clientId)
    .maybeSingle();
  ok(view2?.hair_type === "coily", "once braider-confirmed, the hair type IS visible in the view");

  // A stranger gets nothing from the view at all.
  const { data: strangerView } = await asSnooper
    .from("braider_client_profiles")
    .select("id")
    .eq("id", ids.clientId)
    .maybeSingle();
  ok(!strangerView, "an unrelated user gets nothing from braider_client_profiles");

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} CHECK(S) FAILED.`);
} finally {
  if (ids.bookingId) await admin.from("bookings").delete().eq("id", ids.bookingId);
  if (ids.serviceId) await admin.from("services").delete().eq("id", ids.serviceId);
  if (ids.braiderProfileId)
    await admin.from("braider_profiles").delete().eq("id", ids.braiderProfileId);
  for (const id of [ids.braiderUserId, ids.snooperId, ids.clientId]) {
    if (id) await admin.auth.admin.deleteUser(id);
  }
  console.log("(cleaned up)");
}

process.exit(failures === 0 ? 0 : 1);
