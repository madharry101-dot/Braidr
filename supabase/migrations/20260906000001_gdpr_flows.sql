-- PRD v2.0 §4.12 / Consent Library GDPR-07 & GDPR-08.

-- Account deletion (GDPR-08): 30-day soft-delete. deleted_at is set when
-- the user requests deletion; personal fields are anonymised immediately
-- in the same request. A scheduled job hard-deletes accounts with no
-- financial history after 30 days (accounts with bookings stay anonymised
-- — HMRC 7-year retention, same rule as the admin delete route).
alter table public.profiles add column deleted_at timestamptz;

-- Data export requests (GDPR-07 / Article 15/20). Logged for the 30-day
-- statutory response window; fulfilment is currently manual.
create table public.data_export_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'fulfilled', 'cancelled')),
  requested_at  timestamptz not null default now(),
  fulfilled_at  timestamptz
);

alter table public.data_export_requests enable row level security;

create index idx_data_export_requests_user on public.data_export_requests (user_id, status);

create policy "data_export_requests_select_own"
  on public.data_export_requests for select
  using (user_id = auth.uid());

create policy "data_export_requests_insert_own"
  on public.data_export_requests for insert
  with check (user_id = auth.uid());

-- No UPDATE/DELETE for authenticated users: status changes (fulfilled) are
-- an admin/service-role action.
