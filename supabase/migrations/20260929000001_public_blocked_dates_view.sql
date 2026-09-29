-- R-12, part 1 of 2 — expose braider unavailability WITHOUT the reason.
--
-- THE PROBLEM
-- `braider_blocked_dates` carries a permissive SELECT policy,
-- `blocked_dates_select_any`, with `USING (true)`. Its role is `public`, so
-- anon AND authenticated can read EVERY row and EVERY column of the table:
--   id, braider_id, blocked_date, reason, created_at
-- `reason` is free text a braider writes for themselves — "hospital
-- appointment", "childcare", "my wedding". It is personal data and no part of
-- the app ever reads it except the braider's own settings page.
--
-- WHY THE POLICY EXISTED AT ALL, AND WHY IT IS NOT SIMPLY DELETED
-- The read is genuinely needed: a client choosing a slot must see when a
-- braider is unavailable. `computeAvailability` does exactly that, selecting
-- only `blocked_date` for one braider over a date range. So the fix is not to
-- stop the read, it is to narrow what the read can see.
--
-- This follows the pattern already used twice in this schema for exactly this
-- shape of problem — `public_profiles` (20260911000001) and
-- `braider_client_profiles` (20260911000002): a security_barrier view holding
-- the columns the app legitimately needs, with the base table closed off.
--
-- DELIBERATELY SPLIT ACROSS TWO DEPLOYS.
-- This migration only ADDS the view. `blocked_dates_select_any` is dropped in
-- 20260929000002, after this one is deployed and confirmed. Dropping the
-- policy in the same change would mean any instance still running the old
-- code — during the rollout window, or on a rollback — loses its ability to
-- read blocked dates and silently starts offering slots the braider has
-- blocked. Add the new path first; remove the old one once nothing uses it.

create or replace view public.public_blocked_dates
with (security_barrier = true)
as
  select braider_id, blocked_date
  from public.braider_blocked_dates;

comment on view public.public_blocked_dates is
  'R-12: braider unavailability for the booking flow. Deliberately omits `reason` (personal free text), `id` and `created_at`. Read this, never braider_blocked_dates, when showing anyone other than the braider themselves.';

grant select on public.public_blocked_dates to anon, authenticated;
