-- TRD 3.1.6
create table public.expert_profiles (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null unique references public.profiles(id) on delete cascade,
  credentials             text not null,
  specialisation          text[] not null default '{}',
  clinic_name             text,
  city                    text not null,
  consultation_fee_pence  integer,
  booking_url             text,
  is_verified             boolean not null default false,
  is_active               boolean not null default true,
  referral_count          integer not null default 0,
  credential_doc_path     text,
  created_at              timestamptz not null default now()
);

alter table public.expert_profiles enable row level security;

create index idx_expert_profiles_specialisation on public.expert_profiles using gin (specialisation);

create policy "expert_profiles_select_verified_active_or_own"
  on public.expert_profiles for select
  using ((is_verified = true and is_active = true) or user_id = auth.uid());

create policy "expert_profiles_insert_own"
  on public.expert_profiles for insert
  with check (user_id = auth.uid());

create policy "expert_profiles_update_own"
  on public.expert_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- credential_doc_path: TRD 3.1.6 is explicit — "admin access only" — meaning
-- the expert can upload it but must not be able to read it back afterwards.
-- Column-level revoke enforces that at the database layer.
revoke select (credential_doc_path) on public.expert_profiles from authenticated;

-- is_verified / referral_count / is_active are platform-managed (admin
-- review workflow, referral tracking) — same self-verification risk as
-- braider_profiles, guarded the same way.
create or replace function public.prevent_expert_privileged_field_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.is_verified    is distinct from old.is_verified
    or new.is_active      is distinct from old.is_active
    or new.referral_count is distinct from old.referral_count
    then
      raise exception 'this field is system-managed and can only be changed by the platform';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_expert_privileged_fields
  before update on public.expert_profiles
  for each row execute function public.prevent_expert_privileged_field_update();
