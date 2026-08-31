import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { blockDateSchema } from "@/lib/validations/braider";
import { ok, fail } from "@/lib/api/response";

// POST /api/braiders/:id/blocked-dates — not in the TRD's endpoint table
// (same gap as availability-rules); blocks a single date (holiday, day off).
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(blockDateSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile)
    return fail("FORBIDDEN", "Braider profile not found or not owned by you.", 403);

  const { error } = await supabase
    .from("braider_blocked_dates")
    .insert({ braider_id: params.id, blocked_date: parsed.data.date, reason: parsed.data.reason });

  if (error) return fail("INTERNAL_ERROR", "Failed to block date.", 500);
  return ok({ blocked: true }, 201);
}

// DELETE /api/braiders/:id/blocked-dates — unblocks a date, passed as
// ?date=YYYY-MM-DD.
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const date = request.nextUrl.searchParams.get("date");
  if (!date) return fail("VALIDATION_ERROR", "date query param is required.", 422, "date");

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile)
    return fail("FORBIDDEN", "Braider profile not found or not owned by you.", 403);

  const { error } = await supabase
    .from("braider_blocked_dates")
    .delete()
    .eq("braider_id", params.id)
    .eq("blocked_date", date);

  if (error) return fail("INTERNAL_ERROR", "Failed to unblock date.", 500);
  return ok({ unblocked: true });
}
