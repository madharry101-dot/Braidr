import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { setAvailabilityRulesSchema } from "@/lib/validations/braider";
import { ok, fail } from "@/lib/api/response";

// PUT /api/braiders/:id/availability-rules — not in the TRD's endpoint
// table (see the availability migration note for why this table exists at
// all); replaces the braider's full weekly schedule in one call, since a
// partial-update API for a weekly grid adds complexity with little benefit
// over "the UI always submits the whole week."
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(setAvailabilityRulesSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile)
    return fail("FORBIDDEN", "Braider profile not found or not owned by you.", 403);

  const { error: deleteError } = await supabase
    .from("braider_availability_rules")
    .delete()
    .eq("braider_id", params.id);
  if (deleteError) return fail("INTERNAL_ERROR", "Failed to update availability.", 500);

  if (parsed.data.rules.length > 0) {
    const { error: insertError } = await supabase
      .from("braider_availability_rules")
      .insert(parsed.data.rules.map((r) => ({ braider_id: params.id, ...r })));
    if (insertError) return fail("INTERNAL_ERROR", "Failed to update availability.", 500);
  }

  return ok({ updated: true });
}
