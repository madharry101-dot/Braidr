-- R-13 — stop a stale Stripe event overwriting a newer one's result.
--
-- WHAT REMAINED AFTER R-06
-- R-06 made the subscription and account handlers fetch the CURRENT object
-- from Stripe instead of trusting the event payload, and deduped deliveries
-- with a lease keyed on event.id. But that lease is per EVENT, not per
-- OBJECT: two DIFFERENT events for the same subscription can still be
-- processed at the same time. Both fetch, and the one whose fetch was older
-- can write last.
--
-- Worst case, and the worst failure mode in this whole audit: a cancellation
-- overwritten by a slightly older update, leaving a CANCELLED SUBSCRIBER WITH
-- PAID ACCESS.
--
-- TWO RULES, BOTH ENFORCED HERE RATHER THAN IN THE APPLICATION
--
-- 1. WATERMARK. Each Stripe object records the `created` of the last event
--    applied to it. A strictly OLDER event is refused.
--
--    `<=` not `<` — equal timestamps are ALLOWED through. Stripe's
--    event.created has SECOND resolution, so an `updated` immediately
--    followed by a `deleted` routinely share a second. Rejecting equals would
--    drop whichever arrived second, and if that is the cancellation the
--    subscriber keeps paid access — exactly the bug this closes. Because the
--    handler fetches current state from Stripe, an extra apply is redundant
--    (it re-reads the truth) while a dropped apply can be catastrophic. When
--    the choice is between a redundant write and a lost one, take redundant.
--
-- 2. TERMINAL CANCELLATION. Once a `customer.subscription.deleted` has been
--    applied, no non-cancellation event may ever re-enable that subscription
--    id. This is what closes the same-second interleave the watermark alone
--    cannot: two events sharing a second both pass rule 1, so ordering cannot
--    save us, but a re-enable is refused outright. A genuine resubscribe
--    creates a NEW subscription id, which has no state row and is unaffected.
--
-- WHY THE WRITE LIVES IN THESE FUNCTIONS AND NOT IN THE ROUTE
-- The guard is worthless if another transaction can slip between checking it
-- and writing. Through PostgREST every RPC is its own transaction, so a
-- "claim, then write" pair from the application is NOT atomic: an `updated`
-- could claim while the subscription is still live, a `deleted` could then
-- claim, record the cancellation and write, and the `updated` write could
-- still land last. Doing the guard and the write in one function means the
-- FOR UPDATE row lock is held across both, so concurrent events for one
-- object serialise.

create table if not exists public.stripe_object_state (
  object_id                  text primary key,
  object_type                text not null check (object_type in ('subscription', 'account')),
  last_applied_event_created timestamptz not null,
  last_applied_event_id      text not null,
  -- Non-null means "this subscription is finished, for good". Always null for
  -- accounts; an account is never cancelled.
  cancelled_at               timestamptz,
  updated_at                 timestamptz not null default now()
);

comment on table public.stripe_object_state is
  'R-13: per-Stripe-object watermark and terminal-cancellation flag. Written only through apply_stripe_subscription_state / apply_stripe_account_state, which hold a row lock across guard and write.';

alter table public.stripe_object_state enable row level security;
revoke all on public.stripe_object_state from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The shared guard. Callers MUST invoke this inside the same transaction as
-- their write — the FOR UPDATE lock it takes is what makes the pair atomic.
--
-- Returns 'applied' (caller may write), 'stale' (older event, skip) or
-- 'cancelled' (subscription is terminally cancelled, refuse to re-enable).
-- ---------------------------------------------------------------------------
create or replace function public.claim_stripe_object_write(
  p_object_id       text,
  p_object_type     text,
  p_event_id        text,
  p_event_created   timestamptz,
  p_is_cancellation boolean
) returns text
language plpgsql
as $$
declare
  v public.stripe_object_state%rowtype;
begin
  insert into public.stripe_object_state (
    object_id, object_type, last_applied_event_created, last_applied_event_id, cancelled_at
  )
  values (
    p_object_id, p_object_type, p_event_created, p_event_id,
    case when p_is_cancellation then now() end
  )
  on conflict (object_id) do nothing;

  -- First time we have seen this object — including a brand new subscription
  -- id created by a resubscribe after a cancellation.
  if found then
    return 'applied';
  end if;

  select * into v
  from public.stripe_object_state
  where object_id = p_object_id
  for update;

  -- Rule 2, checked before the watermark: a cancelled subscription stays
  -- cancelled whatever the timestamps say.
  if v.cancelled_at is not null and not p_is_cancellation then
    return 'cancelled';
  end if;

  -- Rule 1. Strictly older only; equal passes deliberately.
  if v.last_applied_event_created > p_event_created then
    return 'stale';
  end if;

  update public.stripe_object_state
     set last_applied_event_created = p_event_created,
         last_applied_event_id      = p_event_id,
         cancelled_at               = coalesce(v.cancelled_at, case when p_is_cancellation then now() end),
         updated_at                 = now()
   where object_id = p_object_id;

  return 'applied';
end;
$$;

-- ---------------------------------------------------------------------------
-- Subscription state. One function for all three subscription streams so the
-- guard cannot be forgotten on one of them.
-- ---------------------------------------------------------------------------
create or replace function public.apply_stripe_subscription_state(
  p_subscription_id    text,
  p_event_id           text,
  p_event_created      timestamptz,
  p_is_cancellation    boolean,
  p_stream             text,
  p_subscribed         boolean,
  p_user_id            uuid default null,
  p_braider_profile_id uuid default null,
  p_status             text default null,
  p_current_period_end timestamptz default null,
  p_price_pence        integer default null
) returns text
language plpgsql
as $$
declare
  v_claim text;
begin
  v_claim := public.claim_stripe_object_write(
    p_subscription_id, 'subscription', p_event_id, p_event_created, p_is_cancellation
  );
  if v_claim <> 'applied' then
    return v_claim;
  end if;

  if p_stream = 'braidcare_client' then
    insert into public.braidcare_subscriptions (
      user_id, role, stripe_subscription_id, status, price_pence, current_period_end
    )
    values (
      p_user_id, 'client', p_subscription_id, p_status, p_price_pence, p_current_period_end
    )
    on conflict (user_id) do update
      set stripe_subscription_id = excluded.stripe_subscription_id,
          status                 = excluded.status,
          price_pence            = excluded.price_pence,
          current_period_end     = excluded.current_period_end;

    update public.profiles
       set braidcare_client_subscribed = p_subscribed
     where id = p_user_id;

  elsif p_stream = 'braidcare_braider' then
    update public.braider_profiles
       set braidcare_subscribed   = p_subscribed,
           braidcare_badge_active = p_subscribed
     where id = p_braider_profile_id;

  elsif p_stream = 'pro' then
    update public.braider_profiles
       set braidr_pro_subscribed      = p_subscribed,
           stripe_pro_subscription_id = case when p_subscribed then p_subscription_id else null end
     where id = p_braider_profile_id;

  else
    raise exception 'unknown subscription stream: %', p_stream;
  end if;

  return 'applied';
end;
$$;

-- ---------------------------------------------------------------------------
-- Connect account state. No cancellation concept, so rule 2 never fires.
-- ---------------------------------------------------------------------------
create or replace function public.apply_stripe_account_state(
  p_account_id      text,
  p_event_id        text,
  p_event_created   timestamptz,
  p_charges_enabled boolean
) returns text
language plpgsql
as $$
declare
  v_claim text;
begin
  v_claim := public.claim_stripe_object_write(
    p_account_id, 'account', p_event_id, p_event_created, false
  );
  if v_claim <> 'applied' then
    return v_claim;
  end if;

  update public.braider_profiles
     set stripe_charges_enabled = p_charges_enabled
   where stripe_account_id = p_account_id;

  return 'applied';
end;
$$;

revoke all on function public.claim_stripe_object_write(text, text, text, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.apply_stripe_subscription_state(text, text, timestamptz, boolean, text, boolean, uuid, uuid, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.apply_stripe_account_state(text, text, timestamptz, boolean) from public, anon, authenticated;

grant execute on function public.claim_stripe_object_write(text, text, text, timestamptz, boolean) to service_role;
grant execute on function public.apply_stripe_subscription_state(text, text, timestamptz, boolean, text, boolean, uuid, uuid, text, timestamptz, integer) to service_role;
grant execute on function public.apply_stripe_account_state(text, text, timestamptz, boolean) to service_role;
