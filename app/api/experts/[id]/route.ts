import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { updateExpertProfileSchema } from "@/lib/validations/expert";
import { ok, fail } from "@/lib/api/response";

// GET /api/experts/:id — TRD 4.7. Owner can see their own pending profile;
// anyone else only if verified + active (same shape as the list route,
// enforced by the same RLS policy).
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: expert } = await supabase
    .from("expert_profiles")
    .select(
      "id, user_id, credentials, specialisation, clinic_name, city, consultation_fee_pence, booking_url, is_verified, is_active"
    )
    .eq("id", params.id)
    .single();

  if (!expert) return fail("NOT_FOUND", "Expert not found.", 404);

  // verification_note is the admin's review reasoning — only fetched (and
  // only ever returned) when the caller is looking at their own profile,
  // never merged into the public-facing shape above, which anyone allowed
  // to see a verified expert's row would otherwise also receive.
  if (expert.user_id === user.id) {
    const { data: own } = await supabase
      .from("expert_profiles")
      .select("verification_note")
      .eq("id", params.id)
      .single();
    return ok({ expert: { ...expert, verification_note: own?.verification_note ?? null } });
  }

  return ok({ expert });
}

// PUT /api/experts/:id — not in the TRD's endpoint table; owner-only
// profile edits, matching the pattern already used for braiders (PUT
// /api/braiders/:id/profile). RLS + the owner-update policy enforce
// ownership; the privileged fields (is_verified etc.) are separately
// guarded regardless of what this route sends.
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(updateExpertProfileSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { data: updated, error } = await supabase
    .from("expert_profiles")
    .update(parsed.data)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !updated)
    return fail("FORBIDDEN", "Expert profile not found or not owned by you.", 403);
  return ok({ updated: true });
}
