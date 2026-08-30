import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { updateProfileSchema } from "@/lib/validations/settings";
import type { HairTypeValue } from "@/lib/hair/textures";
import { ok, fail } from "@/lib/api/response";

// GET /api/settings/profile — TRD v2.0 §4.4. Role-aware; returns the
// editable profile fields plus the (read-only) email and role.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "role, full_name, display_name, avatar_url, phone, city, date_of_birth, hair_type, hair_type_detail, hair_type_source, hair_type_confirmed_by, hair_type_confirmed_at, referral_code"
    )
    .eq("id", user.id)
    .single();
  if (!profile) return fail("NOT_FOUND", "Profile not found.", 404);

  // Resolve the confirming braider's name for the "Confirmed by …" indicator.
  let hair_type_confirmed_by_name: string | null = null;
  if (profile.hair_type_source === "braider_confirmed" && profile.hair_type_confirmed_by) {
    const { data: confirmer } = await supabase
      .from("profiles")
      .select("display_name, full_name")
      .eq("id", profile.hair_type_confirmed_by)
      .maybeSingle();
    hair_type_confirmed_by_name = confirmer?.display_name ?? confirmer?.full_name ?? "your braider";
  }

  return ok({ ...profile, hair_type_confirmed_by_name, email: user.email });
}

// PUT /api/settings/profile — update the caller's own editable fields.
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(updateProfileSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  // Only send keys that were actually provided (undefined = "not in the
  // request"; null = "clear this field").
  const d = parsed.data;
  const patch: {
    display_name?: string | null;
    phone?: string | null;
    city?: string | null;
    avatar_url?: string | null;
    date_of_birth?: string | null;
    hair_type?: HairTypeValue | null;
    hair_type_source?: "self";
    hair_type_confirmed_by?: null;
    hair_type_confirmed_at?: null;
  } = {};
  if (d.display_name !== undefined) patch.display_name = d.display_name;
  if (d.phone !== undefined) patch.phone = d.phone;
  if (d.city !== undefined) patch.city = d.city;
  if (d.avatar_url !== undefined) patch.avatar_url = d.avatar_url;
  if (d.date_of_birth !== undefined) patch.date_of_birth = d.date_of_birth;
  if (d.hair_type !== undefined) {
    // A self-edit always drops any prior braider confirmation — the value
    // is now self-reported again. The privileged-field guard permits these
    // specific transitions (→ 'self', → null) from a non-service client.
    patch.hair_type = d.hair_type;
    patch.hair_type_source = "self";
    patch.hair_type_confirmed_by = null;
    patch.hair_type_confirmed_at = null;
  }
  if (Object.keys(patch).length === 0) return ok({ updated: false });

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) {
    console.error("[settings/profile] update failed", error);
    return fail("INTERNAL_ERROR", "Could not save your changes.", 500);
  }
  return ok({ updated: true });
}
