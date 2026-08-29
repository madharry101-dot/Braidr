import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { updateProfileSchema } from "@/lib/validations/settings";
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
      "role, full_name, display_name, avatar_url, phone, city, date_of_birth, hair_type, referral_code"
    )
    .eq("id", user.id)
    .single();
  if (!profile) return fail("NOT_FOUND", "Profile not found.", 404);

  return ok({ ...profile, email: user.email });
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
    hair_type?: string | null;
  } = {};
  if (d.display_name !== undefined) patch.display_name = d.display_name;
  if (d.phone !== undefined) patch.phone = d.phone;
  if (d.city !== undefined) patch.city = d.city;
  if (d.avatar_url !== undefined) patch.avatar_url = d.avatar_url;
  if (d.date_of_birth !== undefined) patch.date_of_birth = d.date_of_birth;
  if (d.hair_type !== undefined) patch.hair_type = d.hair_type;
  if (Object.keys(patch).length === 0) return ok({ updated: false });

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) {
    console.error("[settings/profile] update failed", error);
    return fail("INTERNAL_ERROR", "Could not save your changes.", 500);
  }
  return ok({ updated: true });
}
