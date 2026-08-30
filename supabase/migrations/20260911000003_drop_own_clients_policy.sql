-- SECURITY — companion to 20260911000002. Apply this ONLY AFTER the code
-- that reads braider_client_profiles has deployed.
--
-- Once this runs, a braider reaches a client's data solely through the
-- braider_client_profiles view. The only remaining way for one user to
-- read another user's profiles row is profiles_select_own (your own row).
--
-- If applied too early, braider-facing screens lose client names and the
-- post-appointment hair-type step until the deploy lands — placeholders,
-- not errors, but still a regression. Hence the split.

drop policy "profiles_select_own_clients" on public.profiles;
