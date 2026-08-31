import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { getAvailabilitySchema } from "@/lib/validations/braider";
import { computeAvailability } from "@/lib/bookings/compute-availability";
import { ok, fail } from "@/lib/api/response";

// GET /api/braiders/:id/availability — TRD 4.3. ?date_from=&date_to=&service_id=
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(getAvailabilitySchema, Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.ok) return parsed.response;
  const { date_from, date_to, service_id } = parsed.data;

  const { data: service } = await supabase
    .from("services")
    .select("duration_mins")
    .eq("id", service_id)
    .eq("braider_id", params.id)
    .single();
  if (!service) return fail("SERVICE_NOT_FOUND", "Service not found for this braider.", 404);

  const slots = await computeAvailability(
    supabase,
    params.id,
    date_from,
    date_to,
    service.duration_mins
  );
  return ok({ slots });
}
