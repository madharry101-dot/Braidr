import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { ok, fail } from "@/lib/api/response";

// POST /api/braiders/:id/stripe/onboard — not in the TRD's endpoint table
// (which describes the webhook side of Connect but not how a braider starts
// onboarding), but stripe_account_id has to get populated somehow. Creates
// the Express account on first call, an onboarding Account Link every call
// (links expire quickly, so re-requesting is the normal flow if a braider
// abandons onboarding partway).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id, user_id, stripe_account_id, city")
    .eq("id", params.id)
    .single();

  if (!braiderProfile) return fail("BRAIDER_NOT_FOUND", "Braider profile not found.", 404);
  if (braiderProfile.user_id !== user.id) {
    return fail("FORBIDDEN", "You can only manage your own Stripe onboarding.", 403);
  }

  const admin = createAdminClient();
  let stripeAccountId = braiderProfile.stripe_account_id;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "GB",
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
    });
    stripeAccountId = account.id;

    const { error } = await admin
      .from("braider_profiles")
      .update({ stripe_account_id: stripeAccountId })
      .eq("id", braiderProfile.id);
    if (error) return fail("INTERNAL_ERROR", "Failed to save Stripe account.", 500);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${siteUrl}/dashboard/braider/payments?refresh=true`,
    return_url: `${siteUrl}/dashboard/braider/payments?onboarded=true`,
    type: "account_onboarding",
  });

  return ok({ onboarding_url: accountLink.url });
}
