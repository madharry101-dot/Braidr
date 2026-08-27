import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { updateServiceSchema } from "@/lib/validations/braider";
import { ok, fail } from "@/lib/api/response";

// PUT /api/braiders/:id/services/:sid — TRD 4.3, owner only.
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; sid: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(updateServiceSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { data: updated, error } = await supabase
    .from("services")
    .update(parsed.data)
    .eq("id", params.sid)
    .eq("braider_id", params.id)
    .select("id")
    .single();

  if (error || !updated) return fail("FORBIDDEN", "Service not found or not owned by you.", 403);
  return ok({ updated: true });
}

// DELETE /api/braiders/:id/services/:sid — TRD 4.3: "Soft-delete a service
// (is_active = false)". Literally an UPDATE — see the services migration
// note on why there's no hard-delete RLS policy at all.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; sid: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: updated, error } = await supabase
    .from("services")
    .update({ is_active: false })
    .eq("id", params.sid)
    .eq("braider_id", params.id)
    .select("id")
    .single();

  if (error || !updated) return fail("FORBIDDEN", "Service not found or not owned by you.", 403);
  return ok({ deactivated: true });
}
