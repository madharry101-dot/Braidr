-- Plan §1.1a — a BraidCare subscriber can run checks "with no booking
-- required". Until now every braidcare_sessions row needed a confirmed
-- booking. Allow a null booking_id, gated on an active subscription.
alter table public.braidcare_sessions alter column booking_id drop not null;

-- Replace the insert policy: free tier still inserts only against one of
-- their own confirmed bookings; a subscriber may also insert a standalone
-- session (booking_id null).
drop policy if exists "braidcare_sessions_insert_own_confirmed_booking"
  on public.braidcare_sessions;

create policy "braidcare_sessions_insert_eligible"
  on public.braidcare_sessions for insert
  with check (
    client_id = auth.uid()
    and (
      booking_id in (
        select id from public.bookings
        where client_id = auth.uid() and status = 'confirmed'
      )
      or (
        booking_id is null
        and exists (
          select 1 from public.braidcare_subscriptions s
          where s.user_id = auth.uid() and s.status = 'active'
        )
      )
    )
  );

-- The braider-visibility half of braidcare_sessions_select_client_or_braider
-- already joins on booking_id, so a standalone (null) session is simply
-- never visible to any braider — which is the intended behaviour.
