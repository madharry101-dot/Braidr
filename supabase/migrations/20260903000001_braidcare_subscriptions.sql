-- TRD v2.0 §3.3 — the client's £7.99/mo BraidCare subscription (unlimited
-- sessions, no booking required). Replaces the profiles.braidcare_client_subscribed
-- boolean as the source of truth: Settings needs status + current_period_end
-- to show "renews on / past due", which a boolean can't express. The
-- boolean stays for now, kept in sync by the webhook, until B6 switches
-- reads over.
--
-- Note: the braider's £14.99/mo BraidCare Professional tier is unchanged —
-- it still lives on braider_profiles.braidcare_subscribed / _badge_active.
-- The `role` column keeps the TRD's shape but only 'client' rows are
-- written today.
create table public.braidcare_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references public.profiles(id) on delete cascade,
  role                   text not null check (role in ('client', 'braider')),
  stripe_subscription_id text not null,
  status                 text not null default 'active'
                           check (status in ('active', 'cancelled', 'past_due')),
  price_pence            integer not null,
  current_period_end     timestamptz not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.braidcare_subscriptions enable row level security;

create trigger set_braidcare_subscriptions_updated_at
  before update on public.braidcare_subscriptions
  for each row execute function public.set_updated_at();

-- SELECT: owner only. INSERT/UPDATE: none for authenticated users — rows
-- are written exclusively by the Stripe webhook via the service-role client
-- (TRD v2.0 §3.3).
create policy "braidcare_subscriptions_select_own"
  on public.braidcare_subscriptions for select
  using (user_id = auth.uid());
