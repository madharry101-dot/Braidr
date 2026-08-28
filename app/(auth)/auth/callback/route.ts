import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /auth/callback — OAuth redirect handler (TRD v2.0 §4.1 / §6.1).
// Exchanges the auth code for a session, then routes:
//   - existing profile  -> /dashboard (middleware sends them to their role home)
//   - no profile yet     -> /auth/complete-registration (role + GDPR-09 consent)
//
// Redirects are built against NEXT_PUBLIC_SITE_URL, not request.url: inside
// Netlify's Next runtime request.url carries the internal deploy-alias host
// (e.g. main--braidr.netlify.app), and an absolute redirect there would
// land the user on a different origin than the one their session cookie is
// scoped to.
export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  const to = (path: string) => NextResponse.redirect(new URL(path, base));

  if (oauthError || !code) return to("/login?error=oauth");

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[auth/callback] code exchange failed", exchangeError);
    return to("/login?error=oauth");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return to("/login?error=oauth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return to(profile ? "/dashboard" : "/auth/complete-registration");
}
