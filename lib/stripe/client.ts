import Stripe from "stripe";

// Server-only. Never import this into a Client Component.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-07-29.dahlia",
  typescript: true,
});
