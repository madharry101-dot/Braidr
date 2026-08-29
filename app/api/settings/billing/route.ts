import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { ok, fail } from "@/lib/api/response";

// GET /api/settings/billing — TRD v2.0 §4.4 (payment-methods + billing
// history, merged). Subscription state comes from our own tables; recent
// receipts come from Stripe if the user has a customer record.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const [{ data: profile }, { data: braidcareSub }] = await Promise.all([
    supabase.from("profiles").select("role, stripe_customer_id").eq("id", user.id).single(),
    supabase
      .from("braidcare_subscriptions")
      .select("status, price_pence, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  let braidrPro: { subscribed: boolean } | null = null;
  if (profile?.role === "braider") {
    const { data: bp } = await supabase
      .from("braider_profiles")
      .select("braidr_pro_subscribed, braidcare_subscribed")
      .eq("user_id", user.id)
      .maybeSingle();
    braidrPro = bp ? { subscribed: bp.braidr_pro_subscribed } : null;
  }

  let invoices: { amount_pence: number; date: string; pdf: string | null; status: string }[] = [];
  if (profile?.stripe_customer_id) {
    try {
      const list = await stripe.invoices.list({ customer: profile.stripe_customer_id, limit: 12 });
      invoices = list.data.map((inv) => ({
        amount_pence: inv.amount_paid,
        date: new Date((inv.created ?? 0) * 1000).toISOString(),
        pdf: inv.invoice_pdf ?? null,
        status: inv.status ?? "unknown",
      }));
    } catch (e) {
      console.error("[settings/billing] Stripe invoice list failed", e);
    }
  }

  return ok({
    braidcare_subscription: braidcareSub ?? null,
    braidr_pro: braidrPro,
    invoices,
  });
}
