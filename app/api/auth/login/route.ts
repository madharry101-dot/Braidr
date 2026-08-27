import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { loginSchema } from "@/lib/validations/auth";
import { ok, fail } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/api/rate-limit";

// POST /api/auth/login — TRD 4.2. Sets HTTP-only session cookie via the
// server Supabase client. No auth required.
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimit = await checkRateLimit("auth", ip);
  if (!rateLimit.success) {
    return fail("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  const parsed = validate(loginSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { email, password } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return fail("UNAUTHENTICATED", "Invalid email or password.", 401);
  }

  // FR-ADMIN-01.1 suspension check. Deliberately checked at login (blocks
  // new sessions) rather than on every single request — an already-live
  // session for a user suspended mid-session stays valid until it next
  // hits a role-gated route (middleware.ts checks there too) or expires
  // naturally. Accepted as good-enough for now; true instant revocation of
  // a live JWT isn't cleanly exposed by the Supabase admin SDK.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_suspended")
    .eq("id", data.user.id)
    .single();
  if (profile?.is_suspended) {
    await supabase.auth.signOut();
    return fail("FORBIDDEN", "This account has been suspended.", 403);
  }

  return ok({ user_id: data.user.id });
}
