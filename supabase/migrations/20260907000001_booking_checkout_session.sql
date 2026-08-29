-- Store the Stripe Checkout Session id on the booking so an unpaid
-- ("pending") booking can be positively cancelled — the session is expired
-- server-side so it can never be paid after the fact (which would charge a
-- client for a booking that no longer exists).
alter table public.bookings add column stripe_checkout_session_id text;
