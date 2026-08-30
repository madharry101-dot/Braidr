-- PART 1 — Hair Type System (client side).
--
-- profiles.hair_type already exists (20260905000001) as free text fed by a
-- "Type 1..Type 4 / Prefer not to say" <select>. This migration:
--   1. normalises it to a small plain-language vocabulary
--      (straight / wavy / curly / coily / prefer_not_to_say; NULL = not set),
--   2. adds provenance columns so a braider's post-appointment confirmation
--      reads as more authoritative than a self-report,
--   3. reserves hair_type_detail for a later 3a/3b/4c sub-category pass
--      (adding it now keeps that a non-breaking change),
--   4. extends the privileged-field guard so only the platform
--      (service_role) can stamp the "confirmed by a braider" state.

-- 1. Normalise existing values by Andre-Walker equivalence (confirmed with
--    the founder). Anything unrecognised → NULL (= not set).
update public.profiles set hair_type = case hair_type
  when 'Type 1'            then 'straight'
  when 'Type 2'            then 'wavy'
  when 'Type 3'            then 'curly'
  when 'Type 4'            then 'coily'
  when 'Prefer not to say' then 'prefer_not_to_say'
  else null
end
where hair_type is not null;

alter table public.profiles
  add constraint profiles_hair_type_check
  check (hair_type is null or hair_type in
    ('straight', 'wavy', 'curly', 'coily', 'prefer_not_to_say'));

-- 2 + 3. Provenance + reserved detail column.
alter table public.profiles
  add column hair_type_detail       text,
  add column hair_type_source       text not null default 'self'
    check (hair_type_source in ('self', 'braider_confirmed')),
  add column hair_type_confirmed_by uuid references public.profiles(id) on delete set null,
  add column hair_type_confirmed_at timestamptz;

-- 4. Guard. A client editing their own hair type via /api/settings/profile
--    uses the ordinary session client, so that path is allowed ONLY to keep
--    source = 'self' and the confirmation columns NULL. The braider
--    confirmation route (POST /api/bookings/:id/confirm-hair-type) writes
--    with the service-role client and is exempt, same as the booking
--    /complete route.
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
