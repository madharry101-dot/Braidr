import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

const DISCLAIMER =
  "This is an income record only. Braidr does not provide financial or tax advice. Consult an accountant for your self-assessment.";

// GET /api/pro/income — TRD 4.6 / PRD FR-PRO-03.2-03.3, 03.6.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile) return fail("ROLE_MISMATCH", "Only braiders have an income record.", 403);

  const { data: records, error } = await supabase
    .from("income_records")
    .select(
      "id, booking_id, service_name, gross_amount_pence, commission_pence, net_amount_pence, tax_year, payment_date"
    )
    .eq("braider_id", braiderProfile.id)
    .order("payment_date", { ascending: false });
  if (error) return fail("INTERNAL_ERROR", "Failed to load income record.", 500);

  const byTaxYear = new Map<string, { gross_pence: number; net_pence: number }>();
  for (const r of records ?? []) {
    const bucket = byTaxYear.get(r.tax_year) ?? { gross_pence: 0, net_pence: 0 };
    bucket.gross_pence += r.gross_amount_pence;
    bucket.net_pence += r.net_amount_pence;
    byTaxYear.set(r.tax_year, bucket);
  }

  // "estimated tax (20% basic rate indicator — not financial advice)" —
  // PRD FR-PRO-03.3. A flat 20% of net earnings, nothing more
  // sophisticated (no personal allowance, no NI) — it's explicitly framed
  // as a rough indicator, not a calculation to build tooling on top of.
  const tax_year_summaries = Array.from(byTaxYear.entries()).map(([tax_year, totals]) => ({
    tax_year,
    total_gross_pence: totals.gross_pence,
    total_net_pence: totals.net_pence,
    estimated_tax_pence: Math.round(totals.net_pence * 0.2),
  }));

  return ok({ records, tax_year_summaries, disclaimer: DISCLAIMER });
}
