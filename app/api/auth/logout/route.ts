import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

// POST /api/auth/logout — TRD 4.2. Auth required.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("UNAUTHENTICATED", "Not signed in.", 401);
  }

  await supabase.auth.signOut();
  return ok({ signed_out: true });
}
