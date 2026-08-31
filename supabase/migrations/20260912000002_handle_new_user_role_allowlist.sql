-- SECURITY FIX (R-01, path B) — never trust raw_user_meta_data->>'role'.
--
-- Supabase GoTrue's public POST /auth/v1/signup accepts an arbitrary `data`
-- object into raw_user_meta_data, and the anon key needed to call it ships in
-- every browser bundle by design. handle_new_user() inserted that value into
-- profiles.role verbatim. registerSchema's z.enum(["client","braider","expert"])
-- guards only the Next.js route, which an attacker bypasses by calling the
-- auth endpoint directly.
--
-- The role is now normalised and coerced against an allowlist at the point of
-- insert, so the database no longer depends on any application layer to be
-- the gate.
--
-- REBASED: this is built on 20260904000001_referral_system.sql, which is the
-- true latest definition and was verified against the live database before
-- writing. An earlier draft was based on 20260902000002 and would have
-- dropped the referral-attribution block below — silently breaking
-- FR-REF-01.4 for every new signup. The v_ref logic here is carried over
-- unchanged.
--
-- PRESERVED DELIBERATELY: the outer `? 'role'` test. Google-OAuth sign-ups
-- carry no role, and the ABSENCE of a profiles row is exactly the signal
-- /auth/callback uses to route them to /auth/complete-registration
-- (20260902000002). Defaulting a missing key to 'client' would auto-create the
-- row and strand every OAuth user on a screen they can never complete.
-- Only a role key that is PRESENT and INVALID falls back to 'client'.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref     text;
  v_claimed text;
  v_norm    text;
  v_role    text;
begin
  v_ref := new.raw_user_meta_data->>'referred_by';
  if v_ref is not null and not exists (
    select 1 from public.profiles where referral_code = v_ref
  ) then
    v_ref := null;
  end if;

  if new.raw_user_meta_data ? 'role' then
    v_claimed := new.raw_user_meta_data->>'role';

    -- Normalise before the allowlist check so a differently-cased or
    -- whitespace-padded but otherwise legitimate role ('Braider', ' expert ')
    -- resolves to itself rather than being silently downgraded to a client.
    v_norm := lower(btrim(coalesce(v_claimed, '')));

    v_role := case
      when v_norm in ('client', 'braider', 'expert') then v_norm
      else 'client'
    end;

    -- Fires only for a genuinely invalid value — 'admin', null, an empty
    -- string, or any unrecognised text. Case and padding differences are
    -- normalised above and never reach here. Signup still succeeds (a hard
    -- failure would be a self-inflicted denial of service on registration),
    -- but the attempt is recorded: an 'admin' claim in the Postgres log is an
    -- attack signal worth alerting on.
    if v_role is distinct from v_norm then
      raise warning '[handle_new_user] rejected non-self-assignable role % for auth user % — defaulted to client',
        coalesce(v_claimed, '<null>'), new.id;
    end if;

    insert into public.profiles (id, role, full_name, referred_by)
    values (
      new.id,
      v_role,
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
