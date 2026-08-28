import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /auth/callback — OAuth redirect handler (TRD v2.0 §4.1 / §6.1).
// Exchanges the auth code for a session, then routes:
//   - existing profile  -> /dashboard (middleware sends them to their role home)
//   - no profile yet     -> /auth/complete-registration (role + GDPR-09 consent)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  const fail = () => NextResponse.redirect(new URL("/login?error=oauth", request.url));

  if (oauthError || !code) return fail();

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[auth/callback] code exchange failed", exchangeError);
    return fail();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return NextResponse.redirect(
    new URL(profile ? "/dashboard" : "/auth/complete-registration", request.url)
  );
}
