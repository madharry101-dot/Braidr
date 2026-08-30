-- SECURITY FIX — stop the profiles base table being broadly public.
--
-- THE PROBLEM
-- `profiles_select_public_braiders_experts` (20260826000012) exists so that
-- search results and directory listings can show a braider's name and
-- avatar. But RLS grants a ROW, not a column list, so that policy exposed
-- the ENTIRE profiles row — phone, date_of_birth, hair_type,
-- stripe_customer_id, referral_code, notification_preferences — for every
-- active braider and every verified expert, to any caller the policy
-- admitted. Only name and avatar were ever needed.
--
-- THE FIX
-- A view that publishes exactly the public-facing columns, and removal of
-- the broad base-table policy. Column-level GRANTs were considered and
-- rejected: a user legitimately reads their own referral_code and phone via
-- /api/settings/profile, so revoking those columns table-wide would break
-- the owner's own reads. A view separates "what is public about someone"
-- from "what someone can see about themselves", which is the actual
-- distinction being drawn.
--
-- The view deliberately does NOT set security_invoker, so it runs with the
-- definer's rights and is unaffected by RLS on profiles — its WHERE clause
-- is the access rule. That is the point: it can publish four columns about
-- a braider without the caller being able to reach the other twenty.
--
-- Rating, verification badge and specialisations are NOT duplicated here.
-- They live on braider_profiles / expert_profiles, which carry no personal
-- contact data and already have appropriately scoped RLS
-- (braider_profiles_select_active_or_own). Copying them would create a
-- second place for them to drift.

create view public.public_profiles as
select
  p.id,
  -- The name the rest of the app already displays: display_name when set,
  -- otherwise full_name. Resolved here so no caller has to fetch both.
  coalesce(nullif(btrim(p.display_name), ''), p.full_name) as name,
  p.avatar_url,
  p.city,
  p.role
from public.profiles p
where
  -- Narrower than the policy it replaces: a suspended or deleted account
  -- should not have its name served from a public endpoint, which the old
  -- policy did not check.
  p.deleted_at is null
  and p.is_suspended = false
  and (
    exists (
      select 1 from public.braider_profiles bp
      where bp.user_id = p.id and bp.is_active = true
    )
    or exists (
      select 1 from public.expert_profiles ep
      where ep.user_id = p.id and ep.is_active = true and ep.is_verified = true
    )
  );

grant select on public.public_profiles to anon, authenticated;

comment on view public.public_profiles is
  'Public-facing subset of profiles for people who have chosen to be listed '
  '(active braiders, verified active experts). Read this instead of the '
  'profiles table for any display of someone other than the caller — the '
  'base table carries phone, date_of_birth, stripe_customer_id and '
  'referral_code, none of which are public.';

-- Remove the over-broad policy. Everything that relied on it now reads the
-- view. What remains on profiles:
--   profiles_select_own          — your own row
--   profiles_select_own_clients  — a braider reading a client they have a
--                                  booking with (still whole-row; narrower
--                                  audience, but worth revisiting)
-- Admin and server-side reads continue to use the service-role client,
-- which bypasses RLS as before.
drop policy "profiles_select_public_braiders_experts" on public.profiles;
