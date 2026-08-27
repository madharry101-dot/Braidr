-- ENGINEERING NOTE: schema additions for the Admin Panel (PRD 4.7).

-- FR-ADMIN-01.1 "suspend ... any user account". profiles has no such flag
-- yet — suspension needs to be reversible and not touch booking/financial
-- history (see the delete-vs-anonymize note on the users route below), so
-- it's a boolean gate checked at login, not a status change to any other
-- table.
alter table public.profiles add column is_suspended boolean not null default false;

create or replace function public.prevent_profile_privileged_field_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.stripe_customer_id          is distinct from old.stripe_customer_id
    or new.braidcare_client_subscribed is distinct from old.braidcare_client_subscribed
    or new.is_suspended                is distinct from old.is_suspended
    then
      raise exception 'this field is system-managed and can only be changed by the platform';
    end if;
  end if;
  return new;
end;
$$;

-- FR-ADMIN-01.4 dispute management. bookings.status already has 'disputed'
-- and 'refunded' in its CHECK constraint (TRD 3.1.4) but nothing before now
-- ever wrote 'disputed', and there's nowhere to record why, or what status
-- to restore on a dismissed dispute (a dispute can be raised against either
-- a 'confirmed' or an already-'completed' booking — dismissing must
-- restore whichever one it actually was, not assume).
alter table public.bookings
  add column dispute_reason text,
  add column pre_dispute_status text,
  add column dispute_resolution_note text;
