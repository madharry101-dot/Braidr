-- R-12, part 2 of 2 — close the base table now that nothing reads it.
--
-- PRECONDITION: 20260929000001 must already be DEPLOYED AND CONFIRMED LIVE.
-- That migration added public.public_blocked_dates and repointed
-- computeAvailability at it. Until that code is actually serving traffic,
-- dropping the policy below would leave any instance still running the old
-- code unable to read blocked dates at all — and because that read fails
-- SILENTLY (the query returns zero rows rather than an error), the symptom
-- would be the booking flow cheerfully offering slots the braider has
-- blocked. That is why this is a separate migration and a separate deploy.
--
-- WHAT THIS REMOVES
-- `blocked_dates_select_any` was SELECT, role `public`, USING (true) — so
-- anon and authenticated could read every row and every column of
-- braider_blocked_dates, including `reason`, the free text a braider writes
-- for themselves. Verified live before the change: a real anonymous client
-- using the public key read that string back.
--
-- WHAT SURVIVES
--   * `blocked_dates_write_own` (ALL, own braider profile) — a braider keeps
--     full read and write over their own rows, INCLUDING reason. That is what
--     the settings page uses.
--   * `public.public_blocked_dates` — the booking flow's read path, exposing
--     braider_id and blocked_date only.
--
-- Re-run scripts/verify-blocked-dates-rls.mjs afterwards. It must be 12/12;
-- it was 8/12 before, and the four failures were this policy.

drop policy if exists blocked_dates_select_any on public.braider_blocked_dates;

-- Belt and braces. With the policy gone, RLS already returns nothing to anon
-- (auth.uid() is null, so blocked_dates_write_own matches no row), but anon
-- has no business holding the grant either. NOT revoked from `authenticated`
-- — braiders reach their own rows through blocked_dates_write_own, and
-- removing the grant would break the settings page.
revoke select on public.braider_blocked_dates from anon;
