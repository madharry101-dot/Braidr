-- FR-ADMIN-01.2 "approve or reject with note" — braider_profiles had no
-- equivalent to expert_profiles.verification_note (added in Sprint 5).
--
-- ENGINEERING NOTE: unlike experts, approving/rejecting a braider does NOT
-- touch is_active here. TRD's own RLS design for braider_profiles ("SELECT:
-- any authenticated user can read active profiles") gates marketplace
-- visibility on is_active alone, defaulting true — a braider is bookable
-- the moment they create a profile. is_verified is a trust badge layered on
-- top, not a pre-publication gate the way it is for experts (where PRD
-- FR-EXP-01.6 explicitly frames onboarding as a "profile publication
-- workflow" — i.e. invisible until approved). Rejecting a braider leaves
-- them live but unverified with a note explaining why, rather than pulling
-- their profile from the marketplace.
alter table public.braider_profiles add column verification_note text;

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
    or new.stripe_pro_subscription_id is distinct from old.stripe_pro_subscription_id
    or new.verification_note      is distinct from old.verification_note
    or new.avg_rating             is distinct from old.avg_rating
    or new.total_reviews          is distinct from old.total_reviews
    then
      raise exception 'this field is system-managed and can only be changed by the platform';
    end if;
  end if;
  return new;
end;
$$;
