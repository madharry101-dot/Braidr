// Persistent demo data for eyeballing the BraidMatch client flow in the
// browser. NOT a test — it leaves rows behind. Re-run safely; it clears its
// own previous demo rows first (matched by the *.demo.braidr email suffix).
//
//   node scripts/seed-braidmatch-demo.mjs
//
// Creates: 1 demo client (demo-client@demo.braidr / demo-password-123),
// and 3 demo braiders each with profile + services + Mon–Sat availability.
// Braider Stripe fields are set service-role so bookings pass the
// payment-ready gate; the Checkout Session itself is a plain platform
// charge (separate charges & transfers), so a placeholder acct id is fine
// in test mode.
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

const CLIENT_EMAIL = "demo-client@demo.braidr";
// A braider account with NO braider_profiles row — for walking the
// dashboard onboarding flow (create profile -> services -> hours -> Stripe).
const FRESH_BRAIDER_EMAIL = "demo-newbraider@demo.braidr";
const PASSWORD = "demo-password-123";

const BRAIDERS = [
  {
    email: "demo-amara@demo.braidr",
    full_name: "Amara Okafor",
    display_name: "Amara Okafor",
    city: "London",
    area: "Peckham",
    bio: "15 years specialising in knotless braids and boho locs. Gentle on your edges, always.",
    years_experience: 15,
    specialisations: ["knotless braids", "box braids", "faux locs", "goddess braids"],
    is_verified: true,
    braidcare_badge_active: true,
    services: [
      {
        name: "Knotless Braids (medium)",
        category: "braids",
        price_from: 12000,
        price_to: 16000,
        duration_mins: 300,
      },
      { name: "Boho Faux Locs", category: "locs", price_from: 15000, duration_mins: 360 },
      { name: "Kids Cornrows", category: "cornrows", price_from: 4500, duration_mins: 90 },
    ],
  },
  {
    email: "demo-blessing@demo.braidr",
    full_name: "Blessing Mensah",
    display_name: "Blessing @ BraidLab",
    city: "London",
    area: "Dalston",
    bio: "Fast, neat cornrows and stitch braids. Same-week appointments most weeks.",
    years_experience: 7,
    specialisations: ["cornrows", "fulani braids", "stitch braids"],
    is_verified: true,
    braidcare_badge_active: false,
    services: [
      {
        name: "Stitch Cornrows (straight back)",
        category: "cornrows",
        price_from: 6000,
        duration_mins: 150,
      },
      {
        name: "Fulani Braids",
        category: "braids",
        price_from: 9000,
        price_to: 11000,
        duration_mins: 240,
      },
    ],
  },
  {
    email: "demo-chidi@demo.braidr",
    full_name: "Chidinma Eze",
    display_name: "Chidinma Eze",
    city: "Manchester",
    area: "Moss Side",
    bio: "Passion twists and Senegalese twists specialist. Protective styling that lasts.",
    years_experience: 10,
    specialisations: ["passion twists", "senegalese twists", "box braids"],
    is_verified: false,
    braidcare_badge_active: false,
    services: [
      {
        name: "Passion Twists (shoulder length)",
        category: "twists",
        price_from: 10000,
        duration_mins: 240,
      },
      {
        name: "Senegalese Twists (waist length)",
        category: "twists",
        price_from: 14000,
        duration_mins: 330,
      },
    ],
  },
];

async function findUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function deleteUserByEmail(email) {
  const existing = await findUserByEmail(email);
  if (!existing) return;
  const userId = existing.id;

  // auth.users -> profiles -> braider_profiles cascade, but income_records
  // and bookings don't cascade from braider_profiles, so GoTrue's delete
  // silently fails while they exist. Clear the dependent rows first.
  const { data: bp } = await admin
    .from("braider_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (bp) {
    await admin.from("income_records").delete().eq("braider_id", bp.id);
    await admin.from("reviews").delete().eq("braider_id", bp.id);
    await admin.from("bookings").delete().eq("braider_id", bp.id);
  }
  await admin.from("bookings").delete().eq("client_id", userId);

  await admin.auth.admin.deleteUser(userId, false); // false = hard delete
}

async function main() {
  console.log("Clearing previous demo rows…");
  // Sequential — concurrent admin auth calls were unreliable.
  for (const email of [CLIENT_EMAIL, FRESH_BRAIDER_EMAIL, ...BRAIDERS.map((b) => b.email)]) {
    await deleteUserByEmail(email);
  }

  console.log("Creating demo client…");
  await admin.auth.admin.createUser({
    email: CLIENT_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "client", full_name: "Demo Client" },
  });

  console.log("Creating fresh braider (no profile)…");
  await admin.auth.admin.createUser({
    email: FRESH_BRAIDER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role: "braider", full_name: "Nia Fresh" },
  });

  for (const b of BRAIDERS) {
    console.log(`Creating braider ${b.display_name}…`);
    const { data: user, error: userErr } = await admin.auth.admin.createUser({
      email: b.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role: "braider", full_name: b.full_name },
    });
    if (userErr) throw userErr;
    const userId = user.user.id;

    await admin
      .from("profiles")
      .update({ display_name: b.display_name, city: b.city })
      .eq("id", userId);

    const { data: profile, error: bpErr } = await admin
      .from("braider_profiles")
      .insert({
        user_id: userId,
        city: b.city,
        area: b.area,
        bio: b.bio,
        years_experience: b.years_experience,
        specialisations: b.specialisations,
      })
      .select("id")
      .single();
    if (bpErr) throw bpErr;

    await admin
      .from("braider_profiles")
      .update({
        is_verified: b.is_verified,
        braidcare_badge_active: b.braidcare_badge_active,
        braidcare_subscribed: b.braidcare_badge_active,
        stripe_account_id: `acct_demo_${profile.id.slice(0, 8)}`,
        stripe_charges_enabled: true,
      })
      .eq("id", profile.id);

    await admin.from("services").insert(b.services.map((s) => ({ braider_id: profile.id, ...s })));

    // Mon–Sat, 09:00–18:00
    await admin.from("braider_availability_rules").insert(
      [1, 2, 3, 4, 5, 6].map((day_of_week) => ({
        braider_id: profile.id,
        day_of_week,
        start_time: "09:00",
        end_time: "18:00",
      }))
    );
  }

  console.log("\nDone.");
  console.log(`Client login:      ${CLIENT_EMAIL} / ${PASSWORD}`);
  console.log(`Braider logins:    ${BRAIDERS.map((b) => b.email).join(", ")} (same password)`);
  console.log(`Fresh braider:     ${FRESH_BRAIDER_EMAIL} (no profile — for onboarding flow)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
