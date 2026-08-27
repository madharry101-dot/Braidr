import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { raiseDisputeSchema } from "@/lib/validations/admin";
import { ok, fail } from "@/lib/api/response";

// POST /api/bookings/:id/dispute — not in the TRD's endpoint table, but
// PRD FR-MATCH-03.9 ("raise a dispute on a booking; admin notified") and
// FR-ADMIN-01.4 ("view reported disputes") both assume something writes
// status = 'disputed' — nothing did until now. Either participant can
// raise one, on a 'confirmed' or 'completed' booking (pre_dispute_status
// records which, so PUT /api/admin/bookings/:id/resolve can restore it
// correctly on dismissal).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(raiseDisputeSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, client_id, braider_id, status")
    .eq("id", params.id)
    .single();
  if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
  if (!["confirmed", "completed"].includes(booking.status)) {
    return fail("VALIDATION_ERROR", "Only a confirmed or completed booking can be disputed.", 422);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("bookings")
    .update({
      status: "disputed",
      pre_dispute_status: booking.status,
      dispute_reason: parsed.data.reason,
    })
    .eq("id", booking.id);
  if (error) return fail("INTERNAL_ERROR", "Failed to raise dispute.", 500);

  return ok({ disputed: true });
}
