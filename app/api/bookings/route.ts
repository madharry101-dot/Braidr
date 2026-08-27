import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { createBookingSchema } from "@/lib/validations/booking";
import { ok, fail } from "@/lib/api/response";
import { computeBookingPricing } from "@/lib/bookings/pricing";
import { hasOverlappingBooking } from "@/lib/bookings/availability";
import { stripe } from "@/lib/stripe/client";

// POST /api/bookings — TRD 4.4. Creates a Stripe Checkout Session (separate
// charges and transfers — see the payment-model decision) and a 'pending'
// booking row holding the slot; checkout.session.completed confirms it.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(createBookingSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { braider_id, service_id, appointment_at } = parsed.data;

  const appointmentDate = new Date(appointment_at);
  if (appointmentDate.getTime() <= Date.now()) {
    return fail(
      "APPOINTMENT_IN_PAST",
      "Appointment time must be in the future.",
      422,
      "appointment_at"
    );
  }

  const [{ data: service }, { data: braider }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, price_from, duration_mins, is_active")
      .eq("id", service_id)
      .single(),
    supabase
      .from("braider_profiles")
      .select("id, stripe_account_id, stripe_charges_enabled, braidr_pro_subscribed, is_active")
      .eq("id", braider_id)
      .single(),
  ]);

  if (!service || !service.is_active) return fail("SERVICE_NOT_FOUND", "Service not found.", 404);
  if (!braider || !braider.is_active) return fail("BRAIDER_NOT_FOUND", "Braider not found.", 404);
  if (!braider.stripe_account_id || !braider.stripe_charges_enabled) {
    return fail(
      "BRAIDER_NOT_PAYMENT_READY",
      "This braider hasn't finished setting up payments yet.",
      422
    );
  }

  const overlap = await hasOverlappingBooking(
    supabase,
    braider_id,
    appointmentDate,
    service.duration_mins
  );
  if (overlap) return fail("SLOT_UNAVAILABLE", "This braider is already booked at that time.", 409);

  const { amount_pence, commission_pence, braider_payout_pence } = computeBookingPricing(
    service.price_from,
    braider.braidr_pro_subscribed
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  // Generated up front — NOT the Stripe Checkout Session id. Found via live
  // testing that session.payment_intent is null at creation time (Stripe
  // only attaches it later in the session's lifecycle), so it can't be used
  // as the correlation key the way TRD 9.3's idempotency-key convention and
  // the original design both assumed. Correlating via metadata.booking_id
  // instead — set on both the session and its resulting PaymentIntent below
  // — works regardless of that timing, and covers both webhook events
  // (checkout.session.completed AND payment_intent.payment_failed) with one
  // mechanism instead of two.
  const bookingId = crypto.randomUUID();
  const idempotencyKey = `checkout-${bookingId}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: service.name },
            unit_amount: amount_pence,
          },
          quantity: 1,
        },
      ],
      // "type" lets the shared webhook handler distinguish this from other
      // Checkout Sessions it now has to handle (BraidCare one-off session
      // purchases) that also fire checkout.session.completed.
      metadata: { type: "booking", booking_id: bookingId },
      payment_intent_data: { metadata: { type: "booking", booking_id: bookingId } },
      success_url: `${siteUrl}/bookings/confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/braiders/${braider_id}?booking=cancelled`,
    },
    { idempotencyKey }
  );

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      id: bookingId,
      client_id: user.id,
      braider_id,
      service_id,
      appointment_at,
      amount_pence,
      commission_pence,
      braider_payout_pence,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !booking) {
    return fail("INTERNAL_ERROR", "Failed to create booking record.", 500);
  }

  return ok({ booking_id: booking.id, checkout_url: session.url }, 201);
}

// GET /api/bookings — TRD 4.4. List bookings for the current user (client or
// braider view — RLS already scopes this to their own rows either way).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id, braider_id, client_id, service_id, status, appointment_at, amount_pence, created_at"
    )
    .order("appointment_at", { ascending: false });

  if (error) return fail("INTERNAL_ERROR", "Failed to load bookings.", 500);
  return ok({ bookings });
}
