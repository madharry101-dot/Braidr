-- TRD v2.0 Section 3.5 / 6.4 + GDPR Consent & Prompts Library "Master
-- Consent Record". Append-only log of every consent given or withdrawn
-- across the platform — the primary accountability evidence under UK GDPR.
--
-- NEVER UPDATE a row. A change of consent state (e.g. withdrawal) is a new
-- row with granted = false, so the full history is preserved.
create table public.consent_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  consent_type    text not null check (consent_type in (
                    'terms_and_privacy',
                    'marketing',
                    'cookies_analytics',
                    'braidcare_photo_processing',
                    'expert_referral_share'
                  )),
  consent_version text not null,           -- e.g. 'privacy-v1.0', 'terms-v1.0'
  granted         boolean not null,        -- true = given, false = withdrawn
  ip_address      text,                    -- accountability evidence (TRD 3.5)
  created_at      timestamptz not null default now()
);

alter table public.consent_events enable row level security;

-- Reading a user's own consent history (Settings → Privacy). Admin reads go
-- through the service-role client, which bypasses RLS — consistent with how
-- every other admin read in this codebase works (no is_admin() in RLS).
create index idx_consent_events_user_type
  on public.consent_events (user_id, consent_type, created_at desc);

create policy "consent_events_select_own"
  on public.consent_events for select
  using (user_id = auth.uid());

-- Any authenticated user may append a consent event for themselves only.
-- The cookie-banner "analytics" consent for a logged-out visitor is stored
-- client-side only until they have an account (Consent Library GDPR-03:
-- "plus a database record if the user is logged in").
create policy "consent_events_insert_own"
  on public.consent_events for insert
  with check (user_id = auth.uid());

-- Append-only: deliberately no UPDATE or DELETE policy. Rows are immutable
-- once written; the on delete cascade above is the only way they leave the
-- table, and only when the whole account is erased (GDPR-08).
