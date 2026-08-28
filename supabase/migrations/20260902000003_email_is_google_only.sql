-- FR-AUTH-02.6 — the forgot-password flow must detect an account that can
-- only sign in with Google (no password identity) and tell the user to use
-- "Continue with Google" instead of emailing a reset link that wouldn't
-- help them.
--
-- SECURITY DEFINER + service-role-only execute: /api/auth/reset-password
-- calls this with the service-role client. It deliberately reveals that a
-- given email is a Google-only account — that disclosure is the point of
-- the feature (a better error than a silently useless reset email).
create or replace function public.email_is_google_only(p_email text)
returns boolean
language sql
security definer
set search_path = auth, public
as $$
  select
    exists (select 1 from auth.users u where lower(u.email) = lower(p_email))
    and not exists (
      select 1 from auth.identities i
      join auth.users u on u.id = i.user_id
      where lower(u.email) = lower(p_email) and i.provider = 'email'
    )
    and exists (
      select 1 from auth.identities i
      join auth.users u on u.id = i.user_id
      where lower(u.email) = lower(p_email) and i.provider = 'google'
    );
$$;

revoke execute on function public.email_is_google_only(text) from public, anon, authenticated;
