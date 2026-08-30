-- PART 1 — Hair Type System (braider side).
--
-- Two new tables:
--   * braider_texture_specialisations — the plain-language textures a braider
--     declares they specialise in (Straight / Wavy / Curly / Coily-Kinky).
--     This is a DIFFERENT axis from braider_profiles.specialisations, which
--     is braiding *styles* (box braids, cornrows, faux locs…). Many-to-one.
--   * braider_portfolio_photos — promotes braider_profiles.portfolio_photos
--     (a bare text[]) to a real table so each photo can carry a texture tag.
--     A specialisation is only "verified" (and only then shown to clients)
--     once at least one portfolio photo is tagged with that texture.
--
-- braider_profiles.portfolio_photos is left in place and back-filled here so
-- the cut-over is not deploy-order-sensitive; a follow-up migration drops it
-- once the table-based code has been stable in production.

-- ── braider_portfolio_photos ────────────────────────────────────────────
create table public.braider_portfolio_photos (
  id           uuid primary key default gen_random_uuid(),
  braider_id   uuid not null references public.braider_profiles(id) on delete cascade,
  storage_path text not null,
  texture      text check (texture in ('straight', 'wavy', 'curly', 'coily')),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create index idx_braider_portfolio_photos_braider on public.braider_portfolio_photos (braider_id);
create index idx_braider_portfolio_photos_texture on public.braider_portfolio_photos (braider_id, texture);

-- Back-fill from the existing array, preserving order.
insert into public.braider_portfolio_photos (braider_id, storage_path, sort_order)
select bp.id, elem.path, elem.ord::int - 1
from public.braider_profiles bp,
     unnest(bp.portfolio_photos) with ordinality as elem(path, ord)
where coalesce(array_length(bp.portfolio_photos, 1), 0) > 0;

alter table public.braider_portfolio_photos enable row level security;

-- Portfolio photos are public content (the bucket is public, they show in
-- search and on public profiles) — anyone signed in can read them.
create policy "braider_portfolio_photos_public_read"
  on public.braider_portfolio_photos for select
  using (true);

create policy "braider_portfolio_photos_owner_insert"
  on public.braider_portfolio_photos for insert
  with check (exists (
    select 1 from public.braider_profiles bp
    where bp.id = braider_id and bp.user_id = auth.uid()
  ));

create policy "braider_portfolio_photos_owner_update"
  on public.braider_portfolio_photos for update
  using (exists (
    select 1 from public.braider_profiles bp
    where bp.id = braider_id and bp.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.braider_profiles bp
    where bp.id = braider_id and bp.user_id = auth.uid()
  ));

create policy "braider_portfolio_photos_owner_delete"
  on public.braider_portfolio_photos for delete
  using (exists (
    select 1 from public.braider_profiles bp
    where bp.id = braider_id and bp.user_id = auth.uid()
  ));

-- ── braider_texture_specialisations ─────────────────────────────────────
create table public.braider_texture_specialisations (
  id          uuid primary key default gen_random_uuid(),
  braider_id  uuid not null references public.braider_profiles(id) on delete cascade,
  texture     text not null check (texture in ('straight', 'wavy', 'curly', 'coily')),
  is_verified boolean not null default false,
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (braider_id, texture)
);

create index idx_braider_texture_spec_braider on public.braider_texture_specialisations (braider_id);
create index idx_braider_texture_spec_lookup on public.braider_texture_specialisations (texture, is_verified);

alter table public.braider_texture_specialisations enable row level security;

-- A verified specialisation is public; an unverified one is visible only to
-- its owner (the client-facing API filters to is_verified anyway, this is
-- defence in depth).
create policy "braider_texture_spec_read"
  on public.braider_texture_specialisations for select
  using (
    is_verified = true
    or exists (
      select 1 from public.braider_profiles bp
      where bp.id = braider_id and bp.user_id = auth.uid()
    )
  );

create policy "braider_texture_spec_owner_insert"
  on public.braider_texture_specialisations for insert
  with check (exists (
    select 1 from public.braider_profiles bp
    where bp.id = braider_id and bp.user_id = auth.uid()
  ));

create policy "braider_texture_spec_owner_delete"
  on public.braider_texture_specialisations for delete
  using (exists (
    select 1 from public.braider_profiles bp
    where bp.id = braider_id and bp.user_id = auth.uid()
  ));

-- No UPDATE policy for the owner at all: is_verified / verified_at are
-- derived state, maintained only by the trigger below. A braider changes
-- their specialisations by inserting/deleting rows, never updating them —
-- so they can't self-award a verified badge.
create policy "braider_texture_spec_service_update"
  on public.braider_texture_specialisations for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── verification recompute ─────────────────────────────────────────────
-- A specialisation is verified iff the braider has >= 1 portfolio photo
-- tagged with that texture. Recomputed whenever either side changes.
create or replace function public.recompute_texture_verification(p_braider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.braider_texture_specialisations s
  set is_verified = t.has_photo,
      verified_at = case
        when t.has_photo and not s.is_verified then now()
        when not t.has_photo then null
        else s.verified_at
      end
  from (
    select s2.id,
           exists (
             select 1 from public.braider_portfolio_photos p
             where p.braider_id = s2.braider_id and p.texture = s2.texture
           ) as has_photo
    from public.braider_texture_specialisations s2
    where s2.braider_id = p_braider_id
  ) t
  where s.id = t.id
    and s.is_verified is distinct from t.has_photo;
end;
$$;

create or replace function public.trg_recompute_texture_verification()
returns trigger
language plpgsql
as $$
begin
  perform public.recompute_texture_verification(
    coalesce(new.braider_id, old.braider_id)
  );
  return null;
end;
$$;

create trigger recompute_on_portfolio_photo_change
  after insert or update or delete on public.braider_portfolio_photos
  for each row execute function public.trg_recompute_texture_verification();

create trigger recompute_on_texture_spec_insert
  after insert on public.braider_texture_specialisations
  for each row execute function public.trg_recompute_texture_verification();
