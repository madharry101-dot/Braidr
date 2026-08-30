-- PART 2 — Blog (educational / health content hub).
--
-- This carries the same language discipline as BraidCare: observational,
-- never diagnostic. The structural expression of that is the mandatory
-- review checkpoint below — no health-adjacent content reaches the public
-- without a second person clearing it, whoever wrote it.
--
-- Authors are admins and dermatologist advisors (role = 'expert'). The
-- existing four-role model already covers this; no new role is introduced.

create table public.blog_posts (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(trim(title)) > 0),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Markdown, rendered through a restricted allowlist (lib/blog/markdown.ts).
  -- Deliberately not MDX: MDX is executable, and executable content authored
  -- by a dozen advisors is not a risk worth taking for a blog.
  body         text not null,
  -- 2-3 line teaser. Also the newsletter teaser (Part 3), hence the length cap.
  excerpt      text not null check (length(trim(excerpt)) > 0 and length(excerpt) <= 400),
  author_id    uuid not null references public.profiles(id) on delete restrict,
  category     text not null check (category in ('educational', 'health_safety', 'expert_content')),
  status       text not null default 'draft' check (status in ('draft', 'in_review', 'published')),
  published_at timestamptz,
  -- Which admin/advisor cleared this for publish. Never the author (below).
  reviewed_by  uuid references public.profiles(id) on delete set null,
  reviewed_at  timestamptz,
  -- "Request changes" note, shown to the author when a post is sent back.
  review_note  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- A published post must have been reviewed, and reviewed by someone other
  -- than its author. Enforced as a table constraint, not just in the route:
  -- there is no code path — service role included — that can publish
  -- unreviewed or self-reviewed content.
  constraint blog_posts_published_needs_review check (
    status <> 'published'
    or (reviewed_by is not null and published_at is not null)
  ),
  constraint blog_posts_no_self_review check (
    reviewed_by is null or reviewed_by <> author_id
  )
);

create index idx_blog_posts_public on public.blog_posts (status, published_at desc);
create index idx_blog_posts_category on public.blog_posts (category, published_at desc);
create index idx_blog_posts_author on public.blog_posts (author_id);

create trigger set_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

-- ── status machine ──────────────────────────────────────────────────────
-- draft -> in_review -> published, and published/in_review -> draft (a
-- "request changes" or an unpublish). draft -> published is rejected
-- whoever attempts it.
create or replace function public.enforce_blog_status_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'a post must be created as a draft';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status = 'published' then
      raise exception 'a post must pass through review before it can be published';
    end if;
    if new.status = 'published' and old.status <> 'in_review' then
      raise exception 'only a post in review can be published';
    end if;
  end if;

  -- Clearing the reviewer while staying published would sidestep the
  -- constraint above on a later update.
  if new.status = 'published' and new.reviewed_by is null then
    raise exception 'a published post must record its reviewer';
  end if;

  return new;
end;
$$;

create trigger enforce_blog_status
  before insert or update on public.blog_posts
  for each row execute function public.enforce_blog_status_transition();

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table public.blog_posts enable row level security;

-- Published posts are public — readable without an account, no paywall.
-- `to public` (not `to authenticated`) so the anon key can read them.
create policy "blog_posts_public_read_published"
  on public.blog_posts for select
  to public
  using (status = 'published');

-- Authors always see their own work, at any status.
create policy "blog_posts_author_read_own"
  on public.blog_posts for select
  to authenticated
  using (author_id = auth.uid());

-- Admins and advisors (experts) see everything — advisors need to read
-- others' drafts to review them.
create policy "blog_posts_staff_read_all"
  on public.blog_posts for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'expert')
    )
  );

-- Admins and advisors can create posts, as themselves only.
create policy "blog_posts_staff_insert"
  on public.blog_posts for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'expert')
    )
  );

-- An author may edit their own post while it is not published. Publishing,
-- reviewing and editing anyone else's post all go through the admin routes
-- on the service-role client — an advisor cannot self-publish, because the
-- only status they can reach from here is 'in_review' (the trigger blocks
-- draft -> published) and the no-self-review constraint blocks them naming
-- themselves as reviewer.
create policy "blog_posts_author_update_own_unpublished"
  on public.blog_posts for update
  to authenticated
  using (author_id = auth.uid() and status <> 'published')
  with check (author_id = auth.uid() and status in ('draft', 'in_review'));

create policy "blog_posts_author_delete_own_draft"
  on public.blog_posts for delete
  to authenticated
  using (author_id = auth.uid() and status = 'draft');

-- No admin-specific INSERT/UPDATE/DELETE policies: admin actions run on the
-- service-role client after isAdmin() in the route, matching every other
-- admin surface in the app.

-- ── blog images ─────────────────────────────────────────────────────────
-- Public bucket, same shape as portfolio-photos: world-readable, and only
-- staff write (enforced in the upload route, which checks the role before
-- using the service-role client).
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

create policy "blog_images_public_read"
  on storage.objects for select
  using (bucket_id = 'blog-images');
