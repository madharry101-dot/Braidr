-- Atomic increment for bookings.sessions_used — called once a BraidCare
-- report is successfully delivered (FR-CARE-02.8: "consumed once report is
-- delivered"). A plain read-then-write from application code would race if
-- two analyse calls somehow overlapped; this does it in one statement.
create or replace function public.increment_booking_sessions_used(p_booking_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.bookings set sessions_used = sessions_used + 1 where id = p_booking_id;
$$;

-- Without this, any authenticated user could call the RPC directly and
-- increment (i.e. burn) an arbitrary booking's session quota — this is only
-- ever meant to be called from the service-role client after the /analyse
-- route has already verified ownership and successful delivery.
revoke execute on function public.increment_booking_sessions_used(uuid) from public, authenticated, anon;

-- Same pattern for the one-off BraidCare session purchase webhook handler.
create or replace function public.increment_booking_sessions_purchased(p_booking_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.bookings set sessions_purchased = sessions_purchased + 1 where id = p_booking_id;
$$;

revoke execute on function public.increment_booking_sessions_purchased(uuid) from public, authenticated, anon;
