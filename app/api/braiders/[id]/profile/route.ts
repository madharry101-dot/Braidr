import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { updateBraiderProfileSchema } from "@/lib/validations/braider";
import { ok, fail } from "@/lib/api/response";

// PUT /api/braiders/:id/profile — TRD 4.3, owner only. RLS
// (braider_profiles_update_own + the privileged-field guard trigger) already
// enforces ownership and blocks system-managed fields, so this can just use
// the regular session client.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(updateBraiderProfileSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { data: updated, error } = await supabase
    .from("braider_profiles")
    .update(parsed.data)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !updated)
    return fail("FORBIDDEN", "Braider profile not found or not owned by you.", 403);
  return ok({ updated: true });
}
