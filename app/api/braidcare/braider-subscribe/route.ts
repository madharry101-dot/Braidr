import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { ok, fail } from "@/lib/api/response";

const BRAIDER_SUBSCRIPTION_PRICE_PENCE = 1499; // £14.99/month, concept doc business model

// POST /api/braidcare/braider-subscribe — TRD 4.5. Braider's own
// professional subscription: unlocks the client-flag view + the
// "BraidCare Professional" badge (braider_profiles.braidcare_badge_active,
// set by the subscription webhook once payment succeeds).
export async function POST() {
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
  if (!braiderProfile)
    return fail("ROLE_MISMATCH", "Only braiders can subscribe to BraidCare Professional.", 403);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: "BraidCare Professional" },
            unit_amount: BRAIDER_SUBSCRIPTION_PRICE_PENCE,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      metadata: { type: "braidcare_braider_subscription", user_id: user.id },
      subscription_data: {
        metadata: { subscription_type: "braidcare_braider", braider_profile_id: braiderProfile.id },
      },
      success_url: `${siteUrl}/dashboard/braider/braidcare?subscribed=true`,
      cancel_url: `${siteUrl}/dashboard/braider/braidcare?subscribed=false`,
    },
    { idempotencyKey: `braidcare-braider-sub-${braiderProfile.id}` }
  );

  return ok({ checkout_url: session.url }, 201);
}
