import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { resolveDisputeSchema } from "@/lib/validations/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { stripe } from "@/lib/stripe/client";
import { ok, fail } from "@/lib/api/response";
import type { BookingStatus } from "@/types/database";

// PUT /api/admin/bookings/:id/resolve — TRD 4.8 / PRD FR-ADMIN-01.4
// "issue refunds". Two outcomes: 'dismiss' restores whichever status the
// booking was in before the dispute (pre_dispute_status — could be
// 'confirmed' or 'completed', not assumed); 'refund' refunds the client
// and sets status to 'refunded'.
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const parsed = validate(resolveDisputeSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select(
      "id, status, pre_dispute_status, amount_pence, stripe_payment_intent_id, stripe_transfer_id"
    )
    .eq("id", params.id)
    .single();
  if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
  if (booking.status !== "disputed") {
    return fail("VALIDATION_ERROR", "This booking is not currently disputed.", 422);
  }

  if (parsed.data.resolution === "dismiss") {
    await admin
      .from("bookings")
      .update({
        status: (booking.pre_dispute_status as BookingStatus | null) ?? "confirmed",
        dispute_resolution_note: parsed.data.note,
      })
      .eq("id", booking.id);
    return ok({ resolution: "dismiss" });
  }

  const refundPence = parsed.data.refund_pence ?? booking.amount_pence;
  if (refundPence > booking.amount_pence) {
    return fail(
      "VALIDATION_ERROR",
      "refund_pence cannot exceed the booking amount.",
      422,
      "refund_pence"
    );
  }
  if (!booking.stripe_payment_intent_id) {
    return fail("INTERNAL_ERROR", "This booking has no payment on record — cannot refund.", 500);
  }

  await stripe.refunds.create(
    { payment_intent: booking.stripe_payment_intent_id, amount: refundPence },
    { idempotencyKey: `dispute-refund-${booking.id}` }
  );

  // If the braider's payout already went out (stripe_transfer_id set), the
  // refund above doesn't claw that back automatically — separate charges
  // and transfers don't link the two the way a destination charge would.
  // Attempt a Transfer Reversal for the refunded amount; this only
  // succeeds if the braider's Connect balance still holds enough (it may
  // not, if they've already been paid out to their bank). Best-effort:
  // failure here doesn't block the client refund, which is the priority —
  // it's surfaced in the response so the admin knows manual reconciliation
  // may be needed.
  let transferReversed = false;
  let transferReversalError: string | null = null;
  if (booking.stripe_transfer_id) {
    try {
      await stripe.transfers.createReversal(booking.stripe_transfer_id, { amount: refundPence });
      transferReversed = true;
    } catch (e) {
      transferReversalError = e instanceof Error ? e.message : "unknown error";
    }
  }

  await admin
    .from("bookings")
    .update({ status: "refunded", dispute_resolution_note: parsed.data.note })
    .eq("id", booking.id);

  return ok({
    resolution: "refund",
    refund_pence: refundPence,
    transfer_reversed: transferReversed,
    transfer_reversal_error: transferReversalError,
  });
}
