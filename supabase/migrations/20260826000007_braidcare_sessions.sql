-- TRD 3.1.5
create table public.braidcare_sessions (
  id                     uuid primary key default gen_random_uuid(),
  booking_id             uuid not null references public.bookings(id),
  client_id              uuid not null references public.profiles(id),
  session_number         integer not null,
  session_type           text not null check (session_type in ('included','purchased_oneoff','subscription')),
  status                 text not null default 'pending' check (status in ('pending','in_progress','completed','expired')),
  photos_count           integer not null default 0,
  photo_paths            text[] not null default '{}',
  ai_raw_response        jsonb,
  -- overall_status / summary: TRD 5.3.3's analyse_scalp tool output includes
  -- these two fields, but the table schema in 3.1.5 omits them — the report
  -- UI (PRD FR-CARE-02.6) can't render a status badge or summary text without
  -- them. Adding both as first-class columns rather than requiring every
  -- read to unpack ai_raw_response (which is access-restricted below).
  overall_status         text check (overall_status in ('looking_good','monitor_closely','consider_rest','seek_specialist')),
  summary                text,
  condition_flags        jsonb not null default '[]',
  recommendations        text[] not null default '{}',
  referral_suggested     boolean not null default false,
  referral_threshold_met text,
  report_delivered_at    timestamptz,
  created_at             timestamptz not null default now()
);

alter table public.braidcare_sessions enable row level security;

create index idx_braidcare_sessions_booking on public.braidcare_sessions (booking_id, session_number);

-- Row visibility: a session is visible to its client, and to the braider of
-- the underlying booking (needed so the braider dashboard / subscription
-- view can query it at all — FR-CARE-03.2/03.7). What actually stops the
-- braider from receiving scalp photos is the column-privilege grant below,
-- not this policy — RLS restricts *rows*, not *columns*.
create policy "braidcare_sessions_select_client_or_braider"
  on public.braidcare_sessions for select
  using (
    client_id = auth.uid()
    or booking_id in (
      select b.id from public.bookings b
      join public.braider_profiles bp on bp.id = b.braider_id
      where bp.user_id = auth.uid()
    )
  );

create policy "braidcare_sessions_insert_own_confirmed_booking"
  on public.braidcare_sessions for insert
  with check (
    client_id = auth.uid()
    and booking_id in (select id from public.bookings where client_id = auth.uid() and status = 'confirmed')
  );

-- ENGINEERING NOTE — enforced at the database layer, not just the API:
-- the concept doc and PRD are explicit and repeated that a subscribed
-- braider "never" sees scalp photos, only condition flags. Revoking table-
-- wide SELECT and re-granting an explicit column list (excluding
-- photo_paths and ai_raw_response, the two sensitive columns) means this
-- holds even if a future API route accidentally does `select *`. The only
-- path back to the photos is a SECURITY DEFINER function scoped to the
-- session's own client, used by the signed-URL route.
revoke select on public.braidcare_sessions from authenticated;
grant select (
  id, booking_id, client_id, session_number, session_type, status,
  photos_count, overall_status, summary, condition_flags, recommendations,
  referral_suggested, referral_threshold_met, report_delivered_at, created_at
) on public.braidcare_sessions to authenticated;
grant insert (booking_id, client_id, session_number, session_type) on public.braidcare_sessions to authenticated;

-- KNOWN LIMITATION (flagged, not fixed here): the column grant above is
-- table-wide for the `authenticated` Postgres role, which both clients and
-- braiders hold — Postgres grants can't distinguish "client" from "braider"
-- within one role. So while photos/raw AI response are genuinely
-- unreachable by anyone, the finer distinction of "braider sees flags but
-- not the summary text" is enforced only by the API layer always querying
-- the braider-facing endpoint with an explicit column list that omits
-- `summary`, not by the database. If this needs to be a hard DB guarantee
-- later, split into a dedicated view or a second Postgres role.
create or replace function public.get_own_braidcare_photos(p_session_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paths text[];
begin
  select photo_paths into v_paths
  from public.braidcare_sessions
  where id = p_session_id and client_id = auth.uid();

  if v_paths is null then
    raise exception 'session not found or not owned by the current user';
  end if;

  return v_paths;
end;
$$;
