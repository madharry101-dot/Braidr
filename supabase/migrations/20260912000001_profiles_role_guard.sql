-- SECURITY FIX (R-01, path A) — profiles.role must not be owner-editable.
--
-- profiles_update_own permits UPDATE with USING/WITH CHECK (auth.uid() = id)
-- and no column restriction, so a user can PATCH their own row directly via
-- PostgREST with the public anon key and their own JWT. Every other
-- system-managed column is already covered by this guard; role was missed,
-- and profiles.role's CHECK constraint accepts 'admin'. That made
-- self-escalation to admin a single REST call — and admin routes run on the
-- service-role client, which bypasses RLS entirely.
--
-- Same reasoning that added full_name in 20260831000003, applied to the one
-- field where it actually matters.
--
-- Role is legitimately written in exactly two places, both on the service-role
-- client, so both are unaffected:
--   app/api/auth/complete-oauth-registration/route.ts:54  (insert)
--   app/api/stripe/webhook/route.ts:277                   (insert)
-- No route updates role on the ordinary server client.
--
-- Every other guarded field and the whole hair_type block below are carried
-- over unchanged from 20260908000001, which was verified byte-for-byte
-- against the live database before this was written.

create or replace function public.prevent_profile_privileged_field_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.role                        is distinct from old.role
    or new.stripe_customer_id          is distinct from old.stripe_customer_id
    or new.braidcare_client_subscribed is distinct from old.braidcare_client_subscribed
    or new.is_suspended                is distinct from old.is_suspended
    or new.full_name                   is distinct from old.full_name
    then
      raise exception 'this field is system-managed and can only be changed by the platform';
    end if;

    -- Block only a *transition into* the confirmed state. Leaving an
    -- existing braider-confirmed value untouched while editing other fields
    -- is fine, and clearing it back to self-reported is fine.
    if (new.hair_type_source is distinct from old.hair_type_source
        and new.hair_type_source <> 'self')
    or (new.hair_type_confirmed_by is distinct from old.hair_type_confirmed_by
        and new.hair_type_confirmed_by is not null)
    or (new.hair_type_confirmed_at is distinct from old.hair_type_confirmed_at
        and new.hair_type_confirmed_at is not null)
    then
      raise exception 'hair_type confirmation state can only be set by the platform';
    end if;
  end if;
  return new;
end;
$$;
