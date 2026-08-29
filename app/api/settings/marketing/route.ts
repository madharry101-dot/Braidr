import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { updateMarketingSchema } from "@/lib/validations/settings";
import { clientIp } from "@/lib/api/rate-limit";
import { MARKETING_VERSION } from "@/lib/consent/versions";
import { ok, fail } from "@/lib/api/response";

// The marketing email toggle. Unlike other notification prefs this is a
// consent decision (GDPR-02): every change appends a consent_events row.

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: latest } = await supabase
    .from("consent_events")
    .select("granted")
    .eq("user_id", user.id)
    .eq("consent_type", "marketing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ok({ opted_in: latest?.granted ?? false });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(updateMarketingSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { error } = await supabase.from("consent_events").insert({
    user_id: user.id,
    consent_type: "marketing",
    consent_version: MARKETING_VERSION,
    granted: parsed.data.opted_in,
    ip_address: clientIp(request),
  });
  if (error) return fail("INTERNAL_ERROR", "Could not update your marketing preference.", 500);

  return ok({ opted_in: parsed.data.opted_in });
}
