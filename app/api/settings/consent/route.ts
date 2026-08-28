import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { consentSchema } from "@/lib/validations/consent";
import { clientIp } from "@/lib/api/rate-limit";
import { ok, fail } from "@/lib/api/response";

// POST /api/settings/consent — TRD v2.0 Section 3.5 / 6.4.
// Appends one consent_events row for the signed-in user. Every consent
// touchpoint in PRD v2.0 §4.12 calls this at the moment consent is given or
// withdrawn. Append-only: a withdrawal is a new row with granted=false, not
// an update.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(consentSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { consent_type, consent_version, granted } = parsed.data;

  const { error } = await supabase.from("consent_events").insert({
    user_id: user.id,
    consent_type,
    consent_version,
    granted,
    ip_address: clientIp(request),
  });

  if (error) {
    console.error("[consent] insert failed", error);
    return fail("INTERNAL_ERROR", "Could not record consent. Please try again.", 500);
  }

  return ok({ recorded: true }, 201);
}
