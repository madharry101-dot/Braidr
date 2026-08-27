-- ENGINEERING NOTE (schema gap fix): TRD 4.6 lists "DELETE /api/pro/subscribe
-- — Cancel Braidr Pro subscription", which requires calling
-- stripe.subscriptions.cancel(id) — but nothing anywhere stores which
-- Stripe subscription belongs to a braider's Pro plan. Adding it.
--
-- Same gap exists for the BraidCare client/braider subscriptions added in
-- Sprint 3 (no stripe_subscription_id stored for either) — not fixed here
-- since neither has a DELETE endpoint in the TRD's table, so nothing
-- currently needs it. Flagging: if in-app cancellation is wanted for those
-- later (rather than customers cancelling via a Stripe billing portal
-- link), the same column needs adding there too.
alter table public.braider_profiles
  add column stripe_pro_subscription_id text;

create or replace function public.prevent_braider_privileged_field_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.is_verified                  is distinct from old.is_verified
    or new.is_active                    is distinct from old.is_active
    or new.braidcare_subscribed         is distinct from old.braidcare_subscribed
    or new.braidcare_badge_active       is distinct from old.braidcare_badge_active
    or new.braidr_pro_subscribed        is distinct from old.braidr_pro_subscribed
    or new.stripe_account_id            is distinct from old.stripe_account_id
    or new.stripe_charges_enabled       is distinct from old.stripe_charges_enabled
    or new.stripe_pro_subscription_id   is distinct from old.stripe_pro_subscription_id
    or new.avg_rating                   is distinct from old.avg_rating
    or new.total_reviews                is distinct from old.total_reviews
    then
      raise exception 'this field is system-managed and can only be changed by the platform';
    end if;
  end if;
  return new;
end;
$$;
