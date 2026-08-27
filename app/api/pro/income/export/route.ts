import { createClient } from "@/lib/supabase/server";
import { fail } from "@/lib/api/response";

// GET /api/pro/income/export — TRD 4.6 / PRD FR-PRO-03.4. CSV, not the
// JSON envelope — this is a file download, so it doesn't go through
// lib/api/response.ts's ok() helper.
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
      "payment_date, service_name, gross_amount_pence, commission_pence, net_amount_pence, tax_year"
    )
    .eq("braider_id", braiderProfile.id)
    .order("payment_date", { ascending: true });
  if (error) return fail("INTERNAL_ERROR", "Failed to load income record.", 500);

  const header = "Date,Service,Gross (GBP),Commission (GBP),Net (GBP),Tax Year";
  const rows = (records ?? []).map((r) =>
    [
      r.payment_date,
      csvEscape(r.service_name),
      (r.gross_amount_pence / 100).toFixed(2),
      (r.commission_pence / 100).toFixed(2),
      (r.net_amount_pence / 100).toFixed(2),
      r.tax_year,
    ].join(",")
  );
  const disclaimerRow =
    "# This is an income record only. Braidr does not provide financial or tax advice.";
  const csv = [header, ...rows, "", disclaimerRow].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="braidr-income-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
