-- TRD 3.1.7
create table public.braidr_pro_progress (
  id                        uuid primary key default gen_random_uuid(),
  braider_id                uuid not null unique references public.braider_profiles(id) on delete cascade,
  assessment_completed      boolean not null default false,
  assessment_results        jsonb,
  step2_hmrc_completed      boolean not null default false,
  -- step2_utr: TRD 6.2 requires this "encrypted... pgcrypto; AES-256".
  -- Encrypting/decrypting via pgcrypto in-database means passing the
  -- encryption key into every query as a literal, which risks it ending up
  -- in Postgres logs/pg_stat_statements. Instead this column stores
  -- ciphertext produced by AES-256-GCM in the application layer
  -- (lib/crypto/utr.ts, key from UTR_ENCRYPTION_KEY, server-only) — the key
  -- never reaches Postgres at all. Masked in the UI regardless.
  step2_utr                 text,
  step3_insurance_completed boolean not null default false,
  step3_insurance_doc_path  text,
  step4_banking_completed   boolean not null default false,
  step4_badge_awarded       boolean not null default false,
  step5_accessed            boolean not null default false,
  -- TRD's generated-column pseudocode for overall_progress_pct ends in
  -- "...(computed)" — the partial-progress formula was left unspecified.
  -- Filling the gap with an even 20% per step across all five steps
  -- (assessment counts as step 1) rather than only reaching 100 at step 4,
  -- so the tracker in FR-PRO-01.3 has a meaningful in-between value.
  overall_progress_pct integer generated always as (
    (case when assessment_completed      then 20 else 0 end) +
    (case when step2_hmrc_completed      then 20 else 0 end) +
    (case when step3_insurance_completed then 20 else 0 end) +
    (case when step4_banking_completed   then 20 else 0 end) +
    (case when step5_accessed            then 20 else 0 end)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.braidr_pro_progress enable row level security;

create trigger set_pro_progress_updated_at
  before update on public.braidr_pro_progress
  for each row execute function public.set_updated_at();

create policy "pro_progress_select_own"
  on public.braidr_pro_progress for select
  using (braider_id in (select id from public.braider_profiles where user_id = auth.uid()));

create policy "pro_progress_insert_own"
  on public.braidr_pro_progress for insert
  with check (braider_id in (select id from public.braider_profiles where user_id = auth.uid()));

create policy "pro_progress_update_own"
  on public.braidr_pro_progress for update
  using (braider_id in (select id from public.braider_profiles where user_id = auth.uid()))
  with check (braider_id in (select id from public.braider_profiles where user_id = auth.uid()));

-- The four *_completed flags are a self-guided checklist by design (this is
-- an onboarding pathway, not an audited compliance record) so the braider
-- may set those directly. step4_badge_awarded is different: it's the
-- Braidr-verified badge shown publicly on the profile (PRD: "Braidr-verified
-- badge awarded on step completion"), and awarding it is the platform's
-- decision after Step 4's real-world requirements are met, not a checkbox
-- the braider ticks themselves.
create or replace function public.prevent_self_badge_award()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' and new.step4_badge_awarded is distinct from old.step4_badge_awarded then
    raise exception 'the verified badge can only be awarded by the platform';
  end if;
  return new;
end;
$$;

create trigger guard_pro_badge_award
  before update on public.braidr_pro_progress
  for each row execute function public.prevent_self_badge_award();
