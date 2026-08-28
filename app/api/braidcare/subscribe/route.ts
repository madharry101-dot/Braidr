import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { ok, fail } from "@/lib/api/response";

const CLIENT_SUBSCRIPTION_PRICE_PENCE = 799; // £7.99/month (plan §1.1a)

// POST /api/braidcare/subscribe — TRD v2.0 §4.2. Client's £7.99/mo unlimited
// BraidCare. No booking required — that was the v1 gate this replaces
// (plan §1.1a live bug). Any client role may subscribe at any time.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "client") {
    return fail("ROLE_MISMATCH", "BraidCare subscriptions are for client accounts.", 403);
  }

  const { data: existing } = await supabase
    .from("braidcare_subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.status === "active") {
    return fail("VALIDATION_ERROR", "You already have an active BraidCare subscription.", 409);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: "BraidCare — unlimited monthly" },
            unit_amount: CLIENT_SUBSCRIPTION_PRICE_PENCE,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      // Top-level metadata so checkout.session.completed can persist the
      // Stripe customer id; subscription_data.metadata is what the
      // customer.subscription.* handler reads.
      metadata: { type: "braidcare_client_subscription", user_id: user.id },
      subscription_data: {
        metadata: { subscription_type: "braidcare_client", user_id: user.id },
      },
      success_url: `${siteUrl}/braidcare?subscribed=true`,
      cancel_url: `${siteUrl}/braidcare?subscribed=false`,
    },
    { idempotencyKey: `braidcare-client-sub-${user.id}` }
  );

  return ok({ checkout_url: session.url }, 201);
}

// DELETE /api/braidcare/subscribe — cancels at period end; access continues
// until current_period_end, then customer.subscription.deleted flips the
// row to 'cancelled'.
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: sub } = await supabase
    .from("braidcare_subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!sub || sub.status !== "active") {
    return fail("NOT_FOUND", "No active BraidCare subscription to cancel.", 404);
  }

  await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
  return ok({ cancel_at_period_end: true });
}
