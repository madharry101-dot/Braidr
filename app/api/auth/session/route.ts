import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

// GET /api/auth/session — TRD 4.2. Returns current session user + role.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("UNAUTHENTICATED", "Not signed in.", 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, display_name, avatar_url, city")
    .eq("id", user.id)
    .single();

  return ok({ user: { id: user.id, email: user.email }, profile });
}
