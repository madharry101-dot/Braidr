-- TRD 3.1.3
create table public.services (
  id            uuid primary key default gen_random_uuid(),
  braider_id    uuid not null references public.braider_profiles(id) on delete cascade,
  name          text not null,
  category      text not null check (category in ('braids','locs','cornrows','twists','other')),
  price_from    integer not null,
  price_to      integer,
  duration_mins integer not null,
  description   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.services enable row level security;

create index idx_services_braider on public.services (braider_id);

create policy "services_select_active"
  on public.services for select
  using (is_active = true or braider_id in (select id from public.braider_profiles where user_id = auth.uid()));

create policy "services_insert_own"
  on public.services for insert
  with check (braider_id in (select id from public.braider_profiles where user_id = auth.uid()));

create policy "services_update_own"
  on public.services for update
  using (braider_id in (select id from public.braider_profiles where user_id = auth.uid()))
  with check (braider_id in (select id from public.braider_profiles where user_id = auth.uid()));

-- No DELETE policy: the "DELETE /api/braiders/:id/services/:sid" endpoint in
-- the TRD is a soft-delete (is_active = false), i.e. an UPDATE under the
-- hood. There is deliberately no way to hard-delete a service row via RLS.
