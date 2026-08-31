import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { createServiceSchema } from "@/lib/validations/braider";
import { ok, fail } from "@/lib/api/response";

// POST /api/braiders/:id/services — TRD 4.3, owner only.
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(createServiceSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile)
    return fail("FORBIDDEN", "Braider profile not found or not owned by you.", 403);

  const { data: service, error } = await supabase
    .from("services")
    .insert({ braider_id: params.id, ...parsed.data })
    .select("id")
    .single();

  if (error || !service) return fail("INTERNAL_ERROR", "Failed to create service.", 500);
  return ok({ service_id: service.id }, 201);
}
