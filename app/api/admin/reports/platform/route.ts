import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/auth/require-admin";
import { ok, fail } from "@/lib/api/response";

// GET /api/admin/reports/platform — TRD 4.8 / PRD FR-ADMIN-01.5, 01.8.
// ?period=week|month controls the time-series bucket (default week).
//
// FR-ADMIN-01.8 also asks for "Stripe reconciliation" — that's a
// meaningfully bigger feature (pulling Stripe's own balance transactions
// and diffing them against these records) than a report endpoint should
// quietly grow into. What's here is the financial summary the PRD lists
// alongside it (commission earned, payouts due); actual Stripe-side
// reconciliation is a deliberate gap, not an oversight.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);
  if (!(await isAdmin(supabase, user.id))) return fail("FORBIDDEN", "Admin only.", 403);

  const period = request.nextUrl.searchParams.get("period") === "month" ? "month" : "week";
  const admin = createAdminClient();

  const [
    { count: totalClients },
    { count: totalBraiders },
    { count: totalExperts },
    { count: proSubscribers },
    { count: totalBraidcareSessions },
    { count: completedBraidcareSessions },
    { data: bookings },
    { data: incomeRecords },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "client")
      .eq("is_suspended", false),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "braider")
      .eq("is_suspended", false),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "expert")
      .eq("is_suspended", false),
    admin
      .from("braider_profiles")
      .select("id", { count: "exact", head: true })
      .eq("braidr_pro_subscribed", true),
    admin.from("braidcare_sessions").select("id", { count: "exact", head: true }),
    admin
      .from("braidcare_sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    admin
      .from("bookings")
      .select("id, status, amount_pence, braider_payout_pence, stripe_transfer_id, created_at"),
    admin.from("income_records").select("commission_pence"),
  ]);

  const processedStatuses = new Set(["confirmed", "completed"]);
  const processedBookings = (bookings ?? []).filter((b) => processedStatuses.has(b.status));
  const gmv_pence = processedBookings.reduce((sum, b) => sum + b.amount_pence, 0);
  const total_commission_pence = (incomeRecords ?? []).reduce(
    (sum, r) => sum + r.commission_pence,
    0
  );
  const payouts_due_pence = (bookings ?? [])
    .filter((b) => b.status === "completed" && !b.stripe_transfer_id)
    .reduce((sum, b) => sum + b.braider_payout_pence, 0);

  const bookingsByStatus: Record<string, number> = {};
  for (const b of bookings ?? [])
    bookingsByStatus[b.status] = (bookingsByStatus[b.status] ?? 0) + 1;

  const timeSeries = bucketByPeriod(bookings ?? [], period);

  return ok({
    active_users: {
      clients: totalClients ?? 0,
      braiders: totalBraiders ?? 0,
      experts: totalExperts ?? 0,
    },
    bookings: { total: bookings?.length ?? 0, by_status: bookingsByStatus },
    gmv_pence,
    braidcare: {
      total_sessions: totalBraidcareSessions ?? 0,
      completed_sessions: completedBraidcareSessions ?? 0,
    },
    pro_subscribers: proSubscribers ?? 0,
    financial: { total_commission_pence, payouts_due_pence },
    time_series: { period, buckets: timeSeries },
  });
}

function bucketByPeriod(
  bookings: Array<{ amount_pence: number; created_at: string; status: string }>,
  period: "week" | "month"
) {
  const buckets = new Map<string, { bookings: number; gmv_pence: number }>();
  for (const b of bookings) {
    const date = new Date(b.created_at);
    const key =
      period === "week"
        ? isoWeekKey(date)
        : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key) ?? { bookings: 0, gmv_pence: 0 };
    bucket.bookings += 1;
    if (b.status === "confirmed" || b.status === "completed") bucket.gmv_pence += b.amount_pence;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, values]) => ({ bucket, ...values }));
}

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
