-- ENGINEERING NOTE: FR-ADMIN-01.6 ("flag and remove inappropriate profile
-- photos or portfolio images") assumes portfolio images already exist as a
-- feature — they don't. PRD FR-MATCH-01.2 calls for "portfolio photos" and
-- the 'portfolio-photos' storage bucket + RLS were created in Sprint 1, but
-- no table ever tracked which files belong to which braider, and no upload
-- endpoint was built. Adding the minimal tracking needed for moderation to
-- have something to act on — this is prerequisite plumbing, not scope
-- creep for this sprint.
alter table public.braider_profiles add column portfolio_photos text[] not null default '{}';

-- Audit trail for admin moderation actions — "flag and remove" is
-- implemented as "an admin reviews and removes it, with a reason recorded"
-- rather than a separate community-reporting/flagging pipeline, since
-- nothing in the PRD describes users reporting content. This table is that
-- record, not a pre-removal flag queue.
create table public.content_moderation_log (
  id               uuid primary key default gen_random_uuid(),
  admin_id         uuid not null references public.profiles(id),
  target_type      text not null check (target_type in ('avatar', 'portfolio_photo')),
  target_user_id   uuid not null references public.profiles(id),
  removed_path     text not null,
  reason           text not null,
  created_at       timestamptz not null default now()
);

alter table public.content_moderation_log enable row level security;

-- No authenticated-role policy at all: admin-only, via the service-role
-- client after the route verifies admin status in code — same pattern as
-- income_records (an append-only ledger nobody self-reports into).

-- FR-ADMIN-01.7 "send platform-wide or targeted announcements to user
-- segments" — a record of what was sent, to whom, and how many received it.
create table public.platform_announcements (
  id               uuid primary key default gen_random_uuid(),
  admin_id         uuid not null references public.profiles(id),
  segment          jsonb not null,
  subject          text not null,
  message          text not null,
  recipient_count  integer not null,
  created_at       timestamptz not null default now()
);

alter table public.platform_announcements enable row level security;
-- Same reasoning: admin-only via service-role, no authenticated policy.
