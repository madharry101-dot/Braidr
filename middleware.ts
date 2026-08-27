import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Route-prefix -> roles allowed to access it. Checked server-side here
// (defence in depth alongside each Route Handler's own session check —
// TRD 6.1: "Next.js middleware checks role before serving protected routes.
// Admin routes blocked client-side and server-side.")
const ROLE_GATED_PREFIXES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/dashboard/braider", roles: ["braider"] },
  { prefix: "/dashboard/expert", roles: ["expert"] },
  { prefix: "/dashboard/client", roles: ["client"] },
  { prefix: "/admin", roles: ["admin"] },
];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const gate = ROLE_GATED_PREFIXES.find(({ prefix }) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  if (!gate) return response;

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Read the user's role. This runs as the authenticated user, so RLS
  // (profiles_select_own) allows exactly this one row.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {
          /* session refresh already handled by updateSession above */
        },
      },
    }
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_suspended")
    .eq("id", user.id)
    .single();

  if (!profile || !gate.roles.includes(profile.role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (profile.is_suspended) {
    // Second enforcement point (first is /api/auth/login) — catches a
    // session that was already live when the suspension happened.
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and image optimisation, so the
     * session cookie stays fresh across the whole app — not just on
     * role-gated routes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
