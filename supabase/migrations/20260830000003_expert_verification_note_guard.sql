-- Extends the existing guard (20260826000008) to also protect
-- verification_note, added this sprint — same reasoning: it's the admin's
-- review note, not something the expert should be able to write themselves
-- via the owner-update policy.
create or replace function public.prevent_expert_privileged_field_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.is_verified        is distinct from old.is_verified
    or new.is_active          is distinct from old.is_active
    or new.referral_count     is distinct from old.referral_count
    or new.verification_note  is distinct from old.verification_note
    then
      raise exception 'this field is system-managed and can only be changed by the platform';
    end if;
  end if;
  return new;
end;
$$;
