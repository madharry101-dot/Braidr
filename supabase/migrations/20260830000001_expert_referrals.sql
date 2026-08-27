-- ENGINEERING NOTE (schema gap fix): TRD 4.7 lists POST/GET
-- /api/experts/referrals, and PRD FR-EXP-01.4/01.5 describe consent-gated
-- flag sharing and fee tracking — but TRD Section 3 (data models) never
-- defines a table for any of this. Designing it now.
create table public.expert_referrals (
  id                  uuid primary key default gen_random_uuid(),
  expert_id           uuid not null references public.expert_profiles(id),
  client_id           uuid not null references public.profiles(id),
  braidcare_session_id uuid references public.braidcare_sessions(id),
  consent_given       boolean not null default false,
  status              text not null default 'referred' check (status in ('referred', 'completed')),
  -- TRD business model: £15-25 per completed consultation. Nothing in TRD
  -- Section 9 (Stripe integration) describes automated collection of this
  -- fee from the expert — Phase 2 is explicitly described as low-volume
  -- "founding contributor" partnerships (concept doc), so this is a manual,
  -- admin-recorded ledger entry (PRD: "admin dashboard records completed
  -- referrals and triggers fee payment"), not an automated charge.
  referral_fee_pence  integer,
  completed_at        timestamptz,
  created_at          timestamptz not null default now()
);

alter table public.expert_referrals enable row level security;

create index idx_expert_referrals_expert on public.expert_referrals (expert_id);
create index idx_expert_referrals_client on public.expert_referrals (client_id);

create policy "expert_referrals_select_own"
  on public.expert_referrals for select
  using (
    client_id = auth.uid()
    or expert_id in (select id from public.expert_profiles where user_id = auth.uid())
  );

-- The client is the one clicking "Speak to a specialist" and giving
-- consent — they own the INSERT. consent_given must be explicit (true),
-- matching FR-EXP-01.4's "if client consents" — a referral record with
-- consent withheld can still exist (so Braidr knows a referral happened)
-- but consent_given must be an honest true/false, not silently forced true.
create policy "expert_referrals_insert_own"
  on public.expert_referrals for insert
  with check (client_id = auth.uid());

-- No authenticated UPDATE policy: marking a referral 'completed' and
-- recording the fee is an admin action (FR-EXP-01.5), done via the
-- service-role client after an admin confirms the consultation actually
-- happened — not something either party can self-report.

-- Lets a consented expert read the flags (never photos — the existing
-- column-privilege revoke on braidcare_sessions already blocks that
-- regardless of which RLS row-policy admits the row) for the specific
-- session a client referred them to. Additive to the existing
-- braidcare_sessions_select_client_or_braider policy — Postgres RLS ORs
-- multiple permissive policies together.
create policy "braidcare_sessions_select_consented_expert"
  on public.braidcare_sessions for select
  using (
    id in (
      select braidcare_session_id from public.expert_referrals
      where consent_given = true
        and expert_id in (select id from public.expert_profiles where user_id = auth.uid())
    )
  );

-- FR-ADMIN-01.3 "approve or reject [credentials]" — a place for the
-- admin's reasoning, shown back to the expert if rejected.
alter table public.expert_profiles add column verification_note text;
