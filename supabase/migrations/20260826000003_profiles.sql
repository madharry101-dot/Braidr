-- TRD 3.1.1 — extends auth.users with application data, for all roles.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('client','braider','expert','admin')),
  full_name    text not null,
  display_name text,
  avatar_url   text,
  phone        text,
  city         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- TRD: "SELECT: authenticated users can read their own row only."
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Deliberately no INSERT policy: rows are created exclusively by the
-- handle_new_user() trigger. Admin access goes through the service role key,
-- which bypasses RLS entirely (per TRD: "Admin role bypasses RLS via service
-- role key").
