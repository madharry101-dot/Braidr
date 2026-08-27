import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session cookie on every request and returns both
 * the (possibly updated) response and the authenticated user, if any.
 * Called from the root middleware.ts — this is what keeps FR-AUTH-01.7
 * ("auto-logout after 30 days of inactivity", i.e. sliding-window sessions)
 * working without every Server Component needing to refresh tokens itself.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not remove. This call is what actually refreshes the
  // token — without it, session cookies silently expire.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
