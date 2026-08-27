import type { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";

// Extracted from app/api/cron/release-payouts/route.ts so /api/cron/daily
// can call it directly (in-process) instead of one Vercel Cron entry per
// task — see that route's comment for why (Hobby plan's cron job count
// limit, on top of the frequency limit already flagged).
export async function runReleasePayouts(admin: ReturnType<typeof createAdminClient>) {
  const holdCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: eligible, error } = await admin
    .from("bookings")
    .select("id, braider_id, braider_payout_pence, stripe_transfer_id, completed_at")
    .eq("status", "completed")
    .is("stripe_transfer_id", null)
    .lte("completed_at", holdCutoff);

  if (error) throw new Error(`Failed to query eligible payouts: ${error.message}`);

  const results: Array<
    { booking_id: string; transfer_id: string } | { booking_id: string; error: string }
  > = [];

  for (const booking of eligible ?? []) {
    try {
      const { data: braiderProfile } = await admin
        .from("braider_profiles")
        .select("stripe_account_id")
        .eq("id", booking.braider_id)
        .single();

      if (!braiderProfile?.stripe_account_id) {
        results.push({ booking_id: booking.id, error: "braider has no stripe_account_id" });
        continue;
      }

      const transfer = await stripe.transfers.create(
        {
          amount: booking.braider_payout_pence,
          currency: "gbp",
          destination: braiderProfile.stripe_account_id,
          transfer_group: booking.id,
          metadata: { booking_id: booking.id },
        },
        { idempotencyKey: `transfer-${booking.id}` }
      );

      await admin.from("bookings").update({ stripe_transfer_id: transfer.id }).eq("id", booking.id);
      results.push({ booking_id: booking.id, transfer_id: transfer.id });
    } catch (e) {
      results.push({
        booking_id: booking.id,
        error: e instanceof Error ? e.message : "unknown error",
      });
    }
  }

  return { processed: results.length, results };
}
