-- PRD v2.0 §4.9 / TRD v2.0 §3.4 — referral system, Phase 1 (link +
-- attribution only, no rewards). Every user gets a unique referral_code at
-- registration; referred_by records who sent them.

-- 1. referral_code — backfill existing rows deterministically (id is a
--    uuid PK, so md5(random || id) can't collide), then lock it down.
alter table public.profiles add column referral_code text;
update public.profiles
  set referral_code = upper(substr(md5(random()::text || id::text), 1, 8))
  where referral_code is null;
alter table public.profiles
  alter column referral_code set not null,
  alter column referral_code set default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  add constraint profiles_referral_code_key unique (referral_code);

-- 2. referred_by — nullable FK to another profile's referral_code.
alter table public.profiles
  add column referred_by text references public.profiles(referral_code);
create index idx_profiles_referred_by on public.profiles (referred_by);

-- 3. handle_new_user() also captures referred_by from raw_user_meta_data
--    (set by /api/auth/register from the /r/{code} cookie). An unknown
--    code is dropped rather than failing the signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
begin
  v_ref := new.raw_user_meta_data->>'referred_by';
  if v_ref is not null and not exists (
    select 1 from public.profiles where referral_code = v_ref
  ) then
    v_ref := null;
  end if;

  if new.raw_user_meta_data ? 'role' then
    insert into public.profiles (id, role, full_name, referred_by)
    values (
      new.id,
      new.raw_user_meta_data->>'role',
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        ''
      ),
      v_ref
    );
  end if;
  return new;
end;
$$;

-- No new RLS policy: the existing profiles SELECT policies already admit
-- exactly the rows each viewer should see. referral_code is low-sensitivity
-- (a braider's code doubles as their public booking link); referred_by is
-- only ever written by the trigger above or the OAuth-completion
-- service-role insert, never by an authenticated user.
