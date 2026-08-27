import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { purchaseSchema } from "@/lib/validations/braidcare";
import { stripe } from "@/lib/stripe/client";
import { ok, fail } from "@/lib/api/response";

const ONEOFF_PRICE_PENCE = 999; // TRD business model: £9.99
const SUBSCRIPTION_PRICE_PENCE = 799; // £7.99/month

// POST /api/braidcare/purchase — TRD 4.5 / concept doc business model.
// One-off (£9.99, one extra session on a specific booking) or monthly
// subscription (£7.99, unlimited sessions across all the client's bookings
// — see profiles.braidcare_client_subscribed).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(purchaseSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { booking_id, type } = parsed.data;

  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("id", booking_id)
    .eq("client_id", user.id)
    .single();
  if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  if (type === "oneoff") {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: user.email,
        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: { name: "BraidCare — additional session" },
              unit_amount: ONEOFF_PRICE_PENCE,
            },
            quantity: 1,
          },
        ],
        metadata: { type: "braidcare_purchase_oneoff", booking_id },
        success_url: `${siteUrl}/braidcare?purchased=true`,
        cancel_url: `${siteUrl}/braidcare?purchased=false`,
      },
      { idempotencyKey: `braidcare-oneoff-${user.id}-${booking_id}-${Date.now()}` }
    );
    return ok({ checkout_url: session.url }, 201);
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: "BraidCare — unlimited monthly" },
            unit_amount: SUBSCRIPTION_PRICE_PENCE,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      // Top-level metadata (not just subscription_data.metadata) so the
      // webhook's checkout.session.completed handler can persist
      // stripe_customer_id without an extra Stripe API call to fetch the
      // subscription.
      metadata: { type: "braidcare_client_subscription", user_id: user.id },
      subscription_data: { metadata: { subscription_type: "braidcare_client", user_id: user.id } },
      success_url: `${siteUrl}/braidcare?subscribed=true`,
      cancel_url: `${siteUrl}/braidcare?subscribed=false`,
    },
    { idempotencyKey: `braidcare-sub-${user.id}` }
  );
  return ok({ checkout_url: session.url }, 201);
}
