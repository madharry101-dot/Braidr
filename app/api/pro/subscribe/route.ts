import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { ok, fail } from "@/lib/api/response";

const PRO_PRICE_PENCE = 3500; // £35/month, concept doc business model

// POST /api/pro/subscribe — TRD 4.6.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id, braidr_pro_subscribed")
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile)
    return fail("ROLE_MISMATCH", "Only braiders can subscribe to Braidr Pro.", 403);
  if (braiderProfile.braidr_pro_subscribed) {
    return fail("VALIDATION_ERROR", "You already have an active Braidr Pro subscription.", 409);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer_email: user.email,
      // FR-PRO-01.2 (P2): first month free trial.
      subscription_data: {
        trial_period_days: 30,
        metadata: { subscription_type: "pro", braider_profile_id: braiderProfile.id },
      },
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: "Braidr Pro" },
            unit_amount: PRO_PRICE_PENCE,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      metadata: { type: "pro_subscription", user_id: user.id },
      success_url: `${siteUrl}/dashboard/braider/pro?subscribed=true`,
      cancel_url: `${siteUrl}/dashboard/braider/pro?subscribed=false`,
    },
    { idempotencyKey: `pro-sub-${braiderProfile.id}` }
  );

  return ok({ checkout_url: session.url }, 201);
}

// DELETE /api/pro/subscribe — TRD 4.6. Cancels at period end (access
// continues until the current billing period runs out, matching the "cancel
// anytime" framing in the concept doc rather than an abrupt cutoff).
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: braiderProfile } = await supabase
    .from("braider_profiles")
    .select("id, stripe_pro_subscription_id")
    .eq("user_id", user.id)
    .single();
  if (!braiderProfile) return fail("ROLE_MISMATCH", "Only braiders can cancel Braidr Pro.", 403);
  if (!braiderProfile.stripe_pro_subscription_id) {
    return fail("VALIDATION_ERROR", "No active Braidr Pro subscription found.", 404);
  }

  await stripe.subscriptions.update(braiderProfile.stripe_pro_subscription_id, {
    cancel_at_period_end: true,
  });

  // braidr_pro_subscribed stays true until the period actually ends —
  // customer.subscription.updated (status still 'active') doesn't change
  // it, and customer.subscription.deleted (fired when the period ends)
  // flips it false, consistent with the "access continues until period end"
  // behaviour just requested from Stripe. Nothing to write here now.
  return ok({ cancel_at_period_end: true });
}
