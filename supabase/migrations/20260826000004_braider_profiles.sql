-- TRD 3.1.2
create table public.braider_profiles (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references public.profiles(id) on delete cascade,
  bio                    text,
  specialisations        text[] not null default '{}',
  city                   text not null,
  area                   text,
  years_experience       integer,
  is_verified            boolean not null default false,
  is_active              boolean not null default true,
  braidcare_subscribed   boolean not null default false,
  braidcare_badge_active boolean not null default false,
  braidr_pro_subscribed  boolean not null default false,
  stripe_account_id      text,
  avg_rating             decimal(3,2),
  total_reviews          integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.braider_profiles enable row level security;

create trigger set_braider_profiles_updated_at
  before update on public.braider_profiles
  for each row execute function public.set_updated_at();

-- GIN index on the array column (style/specialisation search), plus a plain
-- btree on city — together these cover the primary search filter
-- combination (TRD 7.4: "GIN index on city + specialisations array").
create index idx_braider_profiles_specialisations on public.braider_profiles using gin (specialisations);
create index idx_braider_profiles_city on public.braider_profiles (city);

create policy "braider_profiles_select_active_or_own"
  on public.braider_profiles for select
  using (is_active = true or user_id = auth.uid());

create policy "braider_profiles_insert_own"
  on public.braider_profiles for insert
  with check (user_id = auth.uid());

create policy "braider_profiles_update_own"
  on public.braider_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ENGINEERING NOTE (not literal TRD text, added deliberately):
-- The owner-update policy above would otherwise let a braider set their own
-- is_verified / is_active / braidcare_subscribed / braidcare_badge_active /
-- braidr_pro_subscribed / stripe_account_id / avg_rating / total_reviews —
-- i.e. self-award the verified badge or the paid BraidCare badge without a
-- subscription ever existing in Stripe. These are all system-of-record
-- fields written by admin actions or the Stripe webhook handler
-- (service_role). This trigger blocks any other role from changing them,
-- while leaving bio/specialisations/city/area/years_experience freely
-- owner-editable.
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
    or new.avg_rating             is distinct from old.avg_rating
    or new.total_reviews          is distinct from old.total_reviews
    then
      raise exception 'this field is system-managed and can only be changed by the platform';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_braider_privileged_fields
  before update on public.braider_profiles
  for each row execute function public.prevent_braider_privileged_field_update();
