-- ENGINEERING NOTE (schema gap fix): TRD 9.2's webhook table says
-- account.updated "enable[s] payouts when charges_enabled = true", but
-- braider_profiles has nowhere to store that state — only stripe_account_id
-- (which just means "Connect onboarding was started", not "can accept
-- payment"). Bookings need to check this before allowing a client to book
-- (BRAIDER_NOT_PAYMENT_READY), so it has to be a real column, kept in sync
-- by the account.updated webhook handler.
alter table public.braider_profiles
  add column stripe_charges_enabled boolean not null default false;

-- Extend the existing privileged-field guard (20260826000004) to also
-- protect the new column — same reasoning: only the account.updated webhook
-- handler (service_role) should ever flip this, never the braider directly.
create or replace function public.prevent_braider_privileged_field_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.is_verified            is distinct from old.is_verified
    or new.is_active              is distinct from old.is_active
    or new.braidcare_subscribed   is distinct from old.braidcare_subscribed
    or new.braidcare_badge_active is distinct from old.braidcare_badge_active
    or new.braidr_pro_subscribed  is distinct from old.braidr_pro_subscribed
    or new.stripe_account_id      is distinct from old.stripe_account_id
    or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
    or new.avg_rating             is distinct from old.avg_rating
    or new.total_reviews          is distinct from old.total_reviews
    then
      raise exception 'this field is system-managed and can only be changed by the platform';
    end if;
  end if;
  return new;
end;
$$;
