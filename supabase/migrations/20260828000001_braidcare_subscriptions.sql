-- ENGINEERING NOTE (schema gap fix): profiles has nowhere to record a
-- client's BraidCare monthly subscription (£7.99/mo unlimited sessions,
-- PRD FR-CARE-01.7) — braider_profiles has braidcare_subscribed for the
-- braider's own £14.99/mo professional tier, but that's a different
-- subscription on a different role. Also needed: a Stripe customer id to
-- bill against — braider_profiles.stripe_account_id is the braider's
-- Connect account (receives payouts), a completely different Stripe object
-- from "the customer being charged a subscription fee". Any role (client
-- paying for BraidCare, braider paying for Pro or BraidCare Professional)
-- can share one stripe_customer_id per person.
alter table public.profiles
  add column stripe_customer_id text,
  add column braidcare_client_subscribed boolean not null default false;

-- Same self-subscription risk as the other system-managed booleans —
-- only the Stripe webhook handler (service_role) should ever flip these.
create or replace function public.prevent_profile_privileged_field_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.stripe_customer_id           is distinct from old.stripe_customer_id
    or new.braidcare_client_subscribed  is distinct from old.braidcare_client_subscribed
    then
      raise exception 'this field is system-managed and can only be changed by the platform';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_profile_privileged_fields
  before update on public.profiles
  for each row execute function public.prevent_profile_privileged_field_update();
