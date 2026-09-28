import type { createAdminClient } from "@/lib/supabase/admin";

// R-06 — the webhook dedup ledger grows by one row per Stripe delivery and
// nothing else ever removes them.
//
// Only FINISHED rows are purged, and only old ones. A row still marked
// 'processing' is either genuinely in flight or a poison event that keeps
// failing — its `attempts` count is the evidence, so deleting it would throw
// away the only record that something is stuck.
//
// 30 days is comfortably beyond Stripe's retry window (a few days), so a row
// can only be removed once no retry could still arrive for it.
const RETAIN_DAYS = 30;

export async function runPurgeStripeWebhookEvents(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin.rpc("purge_stripe_webhook_events", {
    p_older_than_days: RETAIN_DAYS,
  });
  if (error) throw new Error(`purge_stripe_webhook_events failed: ${error.message}`);
  return { retain_days: RETAIN_DAYS, deleted: data ?? 0 };
}
