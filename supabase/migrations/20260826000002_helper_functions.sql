-- Shared trigger functions used across multiple tables.

-- Generic updated_at maintenance. Applied per-table where the column exists
-- (profiles, braider_profiles, bookings, braidr_pro_progress).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Creates a public.profiles row whenever a new auth.users row is created.
-- Role is read from raw_user_meta_data.role, set by the client at sign-up
-- (PRD FR-AUTH-01.4: role selection determines dashboard and permissions).
-- SECURITY DEFINER: this is the only way a profiles row is ever created —
-- there is deliberately no INSERT policy for authenticated users on profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Used by bookings.braidcare_live_at (a GENERATED column — see
-- 20260826000006_bookings.sql). Postgres's built-in `timestamptz - interval`
-- operator is classified STABLE, not IMMUTABLE — generically, because
-- `interval` can carry month/day components whose arithmetic depends on the
-- session's TimeZone setting. Generated columns require IMMUTABLE, so the
-- bare expression is rejected (42P17: "generation expression is not
-- immutable"), even though *this* interval is a fixed 24-hour duration with
-- no calendar component and is therefore genuinely timezone-independent.
-- Wrapping it in our own function lets us assert that immutability
-- explicitly — this is the standard, documented workaround for this
-- Postgres limitation, not a hack around it.
create or replace function public.minus_24_hours(ts timestamptz)
returns timestamptz
language sql
immutable
parallel safe
as $$
  select ts - interval '24 hours';
$$;
