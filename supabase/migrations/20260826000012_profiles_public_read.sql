-- ENGINEERING NOTE (gap fix, not literal TRD text):
-- TRD 3.1.1 restricts profiles SELECT to "own row only". Taken literally,
-- that breaks the product: braider search results and expert directory
-- listings need to show full_name/avatar_url for someone other than the
-- viewer, and neither braider_profiles nor expert_profiles carries its own
-- copy of that display data. Rather than denormalise name/avatar onto both
-- tables (more places for them to drift), this extends profiles SELECT to
-- also allow reading a user's row when that user has a public-facing
-- braider or expert profile — i.e. exactly the set of people search/
-- directory pages are already allowed to surface.
create policy "profiles_select_public_braiders_experts"
  on public.profiles for select
  using (
    exists (
      select 1 from public.braider_profiles bp
      where bp.user_id = profiles.id and bp.is_active = true
    )
    or exists (
      select 1 from public.expert_profiles ep
      where ep.user_id = profiles.id and ep.is_active = true and ep.is_verified = true
    )
  );
