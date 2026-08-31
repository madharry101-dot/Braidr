import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /r/[code] — referral link handler (PRD v2.0 FR-REF-01.3).
// Sets a 30-day cookie with the referring code, then redirects:
//   - braider's code -> that braider's public profile (doubles as a
//     personal booking link)
//   - any other code -> /register
//   - unknown code   -> /register, no cookie
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function GET(request: NextRequest, props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const code = params.code.trim().toUpperCase();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  const admin = createAdminClient();
  const { data: referrer } = await admin
    .from("profiles")
    .select("id, role")
    .eq("referral_code", code)
    .maybeSingle();

  let destination = "/register";
  if (referrer?.role === "braider") {
    const { data: braiderProfile } = await admin
      .from("braider_profiles")
      .select("id")
      .eq("user_id", referrer.id)
      .maybeSingle();
    if (braiderProfile) destination = `/braiders/${braiderProfile.id}`;
  }

  const res = NextResponse.redirect(new URL(destination, base));
  if (referrer) {
    res.cookies.set("braidr_ref", code, {
      maxAge: COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  }
  return res;
}
