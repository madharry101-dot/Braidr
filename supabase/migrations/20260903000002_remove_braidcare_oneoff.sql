-- Plan §1.1a / PRD v2.0 FR-CARE-01.4 — the one-off £9.99 BraidCare top-up
-- is removed. Free tier keeps its 3-session cap (sessions_allocated /
-- sessions_used stay); only the top-up plumbing goes.
--
-- sessions_purchased is 0 in every row (nothing but the removed top-up ever
-- wrote it), so this drop is non-destructive in practice.
alter table public.bookings drop column if exists sessions_purchased;

drop function if exists public.increment_booking_sessions_purchased(uuid);
