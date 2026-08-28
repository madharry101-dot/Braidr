-- TRD v2.0 §6.1 — Google OAuth. A new OAuth user must pick a role (and give
-- Terms/Privacy consent, GDPR-09) before their account is usable. Google's
-- token carries no role, so handle_new_user() must NOT auto-create a
-- profiles row for them — the absence of a profile is exactly the signal
-- /auth/callback uses to route them to /auth/complete-registration.
--
-- Email/password sign-up is unaffected: /api/auth/register always sends
-- `role` in raw_user_meta_data, so the insert still fires for that path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ? 'role' then
    insert into public.profiles (id, role, full_name)
    values (
      new.id,
      new.raw_user_meta_data->>'role',
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        ''
      )
    );
  end if;
  return new;
end;
$$;
