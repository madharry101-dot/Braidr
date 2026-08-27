-- ENGINEERING NOTE (schema gap fix): PRD FR-MATCH-03.5 requires braiders to
-- "set weekly hours, block specific dates, mark holidays", and TRD 4.3 lists
-- GET /api/braiders/:id/availability as an endpoint — but no table anywhere
-- in TRD 3.1 stores working hours or blocked dates. Without this, the
-- booking flow has no way to know which times are actually offered; adding
-- the minimal schema this requires.

create table public.braider_availability_rules (
  id            uuid primary key default gen_random_uuid(),
  braider_id    uuid not null references public.braider_profiles(id) on delete cascade,
  day_of_week   integer not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time    time not null,
  end_time      time not null check (end_time > start_time),
  created_at    timestamptz not null default now()
);

alter table public.braider_availability_rules enable row level security;

create index idx_availability_rules_braider on public.braider_availability_rules (braider_id, day_of_week);

create policy "availability_rules_select_any"
  on public.braider_availability_rules for select
  using (true); -- needed publicly to compute/display availability

create policy "availability_rules_write_own"
  on public.braider_availability_rules for all
  using (braider_id in (select id from public.braider_profiles where user_id = auth.uid()))
  with check (braider_id in (select id from public.braider_profiles where user_id = auth.uid()));

create table public.braider_blocked_dates (
  id           uuid primary key default gen_random_uuid(),
  braider_id   uuid not null references public.braider_profiles(id) on delete cascade,
  blocked_date date not null,
  reason       text,
  created_at   timestamptz not null default now(),
  unique (braider_id, blocked_date)
);

alter table public.braider_blocked_dates enable row level security;

create index idx_blocked_dates_braider on public.braider_blocked_dates (braider_id, blocked_date);

create policy "blocked_dates_select_any"
  on public.braider_blocked_dates for select
  using (true);

create policy "blocked_dates_write_own"
  on public.braider_blocked_dates for all
  using (braider_id in (select id from public.braider_profiles where user_id = auth.uid()))
  with check (braider_id in (select id from public.braider_profiles where user_id = auth.uid()));
