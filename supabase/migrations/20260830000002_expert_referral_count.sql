-- Atomic increment for expert_profiles.referral_count, same pattern as
-- the BraidCare session counters (20260828000002). Called when a referral
-- is created (POST /api/experts/referrals) — referral_count is a
-- system-managed field an expert can't write directly (see the Update type
-- in types/database.ts), so this is the only path to it.
create or replace function public.increment_expert_referral_count(p_expert_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.expert_profiles set referral_count = referral_count + 1 where id = p_expert_id;
$$;

revoke execute on function public.increment_expert_referral_count(uuid) from public, authenticated, anon;
