-- SECURITY — narrow what a braider can read about a booked client.
--
-- profiles_select_own_clients (20260829000002) let a braider read a client's
-- WHOLE profiles row once they shared a booking — RLS grants a row, not a
-- column list, so that included stripe_customer_id, referral_code,
-- date_of_birth, notification_preferences. A braider needs a name, a way to
-- contact the client, and (for the post-appointment step) the hair type
-- they themselves confirmed. Nothing else.
--
-- Founder decision, 2026-08-30:
--   * expose: name, avatar, phone, braider-confirmed hair type (+ when/who)
--   * drop entirely: stripe_customer_id, referral_code — no braider use case
--   * defer: date_of_birth — a separate legal read is pending on whether a
--     derived is_minor flag is needed for safeguarding; until then, out.
--
-- The client's OWN self-reported hair type is deliberately not exposed
-- either: a braider contributes their professional observation after the
-- appointment, they don't get the client's private self-assessment. So the
-- view's hair_type column is non-null only when a braider has confirmed it.

create view public.braider_client_profiles
with (security_barrier = true) as
select
  p.id,
  coalesce(nullif(btrim(p.display_name), ''), p.full_name) as name,
  p.avatar_url,
  p.phone,
  case
    when p.hair_type_source = 'braider_confirmed' then p.hair_type
  end as hair_type,
  p.hair_type_confirmed_at,
  p.hair_type_confirmed_by
from public.profiles p
where exists (
  select 1
  from public.bookings b
  join public.braider_profiles bp on bp.id = b.braider_id
  where b.client_id = p.id
    and bp.user_id = auth.uid()
);

grant select on public.braider_client_profiles to authenticated;

comment on view public.braider_client_profiles is
  'A braider''s view of a client they have a booking with: name, avatar, '
  'phone, and the braider-confirmed hair type only. Read this instead of '
  'the profiles table — the base row carries stripe_customer_id, '
  'referral_code and date_of_birth, none of which a braider may see.';

-- The base-table policy this replaces. From here, a braider reaches a
-- client's data only through the view above; nothing else on profiles
-- lets one user read another's row except profiles_select_own.
drop policy "profiles_select_own_clients" on public.profiles;

-- Consistency hardening: give the sibling view the same barrier so a
-- caller-supplied predicate can't be pushed below its WHERE clause.
alter view public.public_profiles set (security_barrier = true);
