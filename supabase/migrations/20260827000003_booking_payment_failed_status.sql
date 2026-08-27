-- ENGINEERING NOTE (schema gap fix): TRD 9.2's webhook table says
-- payment_intent.payment_failed should "update booking to payment_failed
-- status", but the original status CHECK constraint (TRD 3.1.4) doesn't
-- include that value. Extending it.
alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in (
    'pending','confirmed','completed',
    'cancelled_client','cancelled_braider',
    'disputed','refunded','payment_failed'
  ));
