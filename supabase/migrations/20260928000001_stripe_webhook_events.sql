-- R-06 — replay and concurrency protection for POST /api/stripe/webhook.
--
-- THE PROBLEM
-- Stripe retries a delivery whenever it does not get a 2xx, and can deliver
-- the same event more than once even on success. Nothing recorded event.id,
-- so a replay re-ran the handler. Most of the damage was bounded by luck
-- rather than design: income_records has UNIQUE(booking_id), and the
-- booking-status guards are mostly idempotent. What was NOT bounded is
-- notification email, which went out again on every replay.
--
-- WHY A PLAIN "INSERT FIRST, THEN PROCESS" IS NOT ENOUGH
-- Insert-first dedup marks an event as done before it IS done. If the handler
-- then throws — or the function is killed mid-flight — the row is already
-- there, the retry is swallowed as a duplicate, and the event is lost
-- silently. That is the failure mode this whole audit keeps finding, so it is
-- worth not building another one.
--
-- WHAT THIS DOES INSTEAD: a lease.
--   claim    -> insert 'processing' with a lease timestamp, atomically
--   success  -> mark 'processed' (only then is it really done)
--   failure  -> expire the lease so the next Stripe retry picks it up
--   crash    -> nobody expires anything, but the lease ages out and the next
--               retry reclaims it
-- An event being worked on right now is reported as in-flight, and the route
-- answers non-2xx so Stripe retries rather than dropping it.

create table if not exists public.stripe_webhook_events (
  event_id     text primary key,          -- Stripe's evt_... — the dedup key
  type         text not null,
  status       text not null default 'processing'
               check (status in ('processing', 'processed')),
  -- When the current attempt took the lease. Only meaningful while
  -- status = 'processing'.
  locked_at    timestamptz not null default now(),
  processed_at timestamptz,
  -- Climbs on every reclaim. A high value here is a poison event that keeps
  -- failing — the reason a failure expires the lease instead of deleting the
  -- row, which would reset the count and hide it.
  attempts     integer not null default 1,
  created_at   timestamptz not null default now()
);

comment on table public.stripe_webhook_events is
  'R-06 dedup ledger for Stripe webhook deliveries. Written only by the service role; see claim/complete/release functions.';

create index if not exists idx_stripe_webhook_events_created
  on public.stripe_webhook_events (created_at);

-- Lets the daily purge find finished rows without scanning the table.
create index if not exists idx_stripe_webhook_events_status_processed
  on public.stripe_webhook_events (status, processed_at);

-- RLS on with NO policies: the service role bypasses RLS, and nobody else
-- has any business reading this. Deliberately not "no RLS" — an unprotected
-- table is one PostgREST exposure away from being public.
alter table public.stripe_webhook_events enable row level security;

revoke all on public.stripe_webhook_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- claim: the only atomic step that matters.
--
-- Returns one of:
--   'claimed'               caller owns this event, process it
--   'reclaimed'             a previous attempt died; lease expired; process it
--   'already_processed'     a genuine duplicate, acknowledge and do nothing
--   'in_flight'             another delivery holds the lease right now
--
-- Concurrency note: two simultaneous deliveries both reach the INSERT. One
-- wins. The other's ON CONFLICT DO NOTHING blocks on the uncommitted row,
-- then finds FOUND = false and reads status = 'processing' with a fresh
-- lease, so it returns 'in_flight'. That is why this is one function and not
-- a read-then-write in application code.
-- ---------------------------------------------------------------------------
create or replace function public.claim_stripe_webhook_event(
  p_event_id      text,
  p_type          text,
  p_lease_seconds integer default 60
) returns text
language plpgsql
as $$
declare
  v_status    text;
  v_locked_at timestamptz;
begin
  insert into public.stripe_webhook_events (event_id, type)
  values (p_event_id, p_type)
  on conflict (event_id) do nothing;

  if found then
    return 'claimed';
  end if;

  select status, locked_at
    into v_status, v_locked_at
  from public.stripe_webhook_events
  where event_id = p_event_id
  for update;

  if v_status = 'processed' then
    return 'already_processed';
  end if;

  if v_locked_at < now() - make_interval(secs => p_lease_seconds) then
    update public.stripe_webhook_events
       set locked_at = now(),
           attempts  = attempts + 1
     where event_id = p_event_id;
    return 'reclaimed';
  end if;

  return 'in_flight';
end;
$$;

create or replace function public.complete_stripe_webhook_event(p_event_id text)
returns void
language sql
as $$
  update public.stripe_webhook_events
     set status = 'processed', processed_at = now()
   where event_id = p_event_id;
$$;

-- Expires the lease rather than deleting the row, so `attempts` survives and
-- a repeatedly-failing event is visible instead of looking brand new.
create or replace function public.release_stripe_webhook_event(p_event_id text)
returns void
language sql
as $$
  update public.stripe_webhook_events
     set locked_at = '-infinity'::timestamptz
   where event_id = p_event_id
     and status = 'processing';
$$;

-- Called by the daily cron. Only finished rows, and only old ones — a
-- 'processing' row is either in flight or a poison event worth keeping.
create or replace function public.purge_stripe_webhook_events(p_older_than_days integer default 30)
returns integer
language plpgsql
as $$
declare
  v_deleted integer;
begin
  delete from public.stripe_webhook_events
   where status = 'processed'
     and processed_at < now() - make_interval(days => p_older_than_days);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text, integer)  from public, anon, authenticated;
revoke all on function public.complete_stripe_webhook_event(text)              from public, anon, authenticated;
revoke all on function public.release_stripe_webhook_event(text)               from public, anon, authenticated;
revoke all on function public.purge_stripe_webhook_events(integer)             from public, anon, authenticated;

grant execute on function public.claim_stripe_webhook_event(text, text, integer)  to service_role;
grant execute on function public.complete_stripe_webhook_event(text)              to service_role;
grant execute on function public.release_stripe_webhook_event(text)               to service_role;
grant execute on function public.purge_stripe_webhook_events(integer)             to service_role;
