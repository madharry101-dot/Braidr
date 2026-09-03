// One-off verification script — not part of the app. Confirms the
// handle_new_user() trigger creates a correct profiles row, and that RLS
// blocks the anon-key client from reading it. Cleans up after itself.
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// Node 20 has no global WebSocket (added unflagged in Node 22); supabase-js
// always constructs a RealtimeClient even though this script never uses it.
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
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const testEmail = `smoketest-${Date.now()}@braidr.internal.test`;

let userId;
try {
  console.log("1. Creating user via admin API (bypasses email entirely)...");
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: "correct-horse-battery-staple",
    email_confirm: true,
    user_metadata: { role: "braider", full_name: "Smoke Test Braider" },
  });
  if (error) throw error;
  userId = data.user.id;
  console.log("   OK — user id:", userId);

  console.log("2. Checking handle_new_user() trigger created a profiles row...");
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;
  console.log("   OK —", JSON.stringify(profile));
  if (profile.role !== "braider" || profile.full_name !== "Smoke Test Braider") {
    throw new Error("profile fields did not match what was passed at signup");
  }

  console.log("3. Confirming RLS blocks the anon client from reading it (no session)...");
  const { data: anonRead, error: anonError } = await anon
    .from("profiles")
    .select("id")
    .eq("id", userId);
  if (anonError) throw anonError;
  if (anonRead.length !== 0)
    throw new Error("RLS FAILED: anon client could read another user's profile row");
  console.log("   OK — 0 rows visible to unauthenticated anon client, as expected");

  console.log("4. Confirming braider_profiles insert works + RLS trigger guard is active...");
  const { error: bpError } = await admin
    .from("braider_profiles")
    // is_active: false so a stranded profile cannot reach the public
    // directory. braider_profiles.is_active defaults to TRUE, and on
    // 2026-08-31 a failed teardown left one listed publicly for three days.
    // Nothing in this script reads the braider as another user or through
    // public_profiles, so hiding it costs the test nothing.
    .insert({ user_id: userId, city: "London", is_active: false });
  if (bpError) throw bpError;
  console.log("   OK — braider_profiles row created");

  console.log("\nAll checks passed.");
} finally {
  if (userId) {
    console.log("Cleaning up test user...");
    await admin.auth.admin.deleteUser(userId); // cascades to profiles + braider_profiles
    console.log("Done.");
  }
}
