-- PRD v2.0 §4.10 — Settings. New profile fields:
--   notification_preferences — per-event email on/off blob. Absent key =
--     default on (opt-out model); "marketing" is governed by consent_events,
--     not this blob.
--   date_of_birth / hair_type — client Profile section (§4.10.1). Both
--     optional.
alter table public.profiles
  add column notification_preferences jsonb not null default '{}'::jsonb,
  add column date_of_birth date,
  add column hair_type text;

-- These are all owner-editable via the existing profiles_update_own policy
-- (auth.uid() = id, no column restriction) and are not in the
-- prevent_profile_privileged_field_update() guard, so /api/settings/*
-- can write them with the ordinary server client.
