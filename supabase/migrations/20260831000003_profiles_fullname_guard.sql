-- full_name is now in the Update type (for the admin anonymisation path,
-- DELETE /api/admin/users/:id) but was never meant to be owner-editable —
-- there's no route exposing that, and profiles_update_own has no column
-- restriction, so without this a user could rename themselves via a raw
-- REST call with their own session. Folding it into the existing guard.
create or replace function public.prevent_profile_privileged_field_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.stripe_customer_id          is distinct from old.stripe_customer_id
    or new.braidcare_client_subscribed is distinct from old.braidcare_client_subscribed
    or new.is_suspended                is distinct from old.is_suspended
    or new.full_name                   is distinct from old.full_name
    then
      raise exception 'this field is system-managed and can only be changed by the platform';
    end if;
  end if;
  return new;
end;
$$;
