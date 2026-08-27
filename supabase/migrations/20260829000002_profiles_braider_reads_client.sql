-- ENGINEERING NOTE (gap fix): the profiles_select_public_braiders_experts
-- policy (Sprint 1) only opened visibility in the client-sees-braider
-- direction, since braiders/experts are publicly listed. Nothing opened the
-- reverse — a braider reading their own client's name — even though
-- FR-MATCH-03.3 ("Client list: name, booking history") requires exactly
-- that, and it's needed again right now for the Pro invoice generator
-- (POST /api/pro/invoices) to put a client's name on the document. Scoped
-- narrowly: a braider can read a client's profile only if that client has
-- at least one booking with them — not an open "any braider sees any
-- client" policy.
create policy "profiles_select_own_clients"
  on public.profiles for select
  using (
    exists (
      select 1 from public.bookings b
      join public.braider_profiles bp on bp.id = b.braider_id
      where b.client_id = profiles.id and bp.user_id = auth.uid()
    )
  );
