-- TRD 3.1.9
create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null unique references public.bookings(id),
  client_id    uuid not null references public.profiles(id),
  braider_id   uuid not null references public.braider_profiles(id),
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.reviews enable row level security;

create index idx_reviews_braider on public.reviews (braider_id);

create policy "reviews_select_published_or_own"
  on public.reviews for select
  using (
    is_published = true
    or client_id = auth.uid()
    or braider_id in (select id from public.braider_profiles where user_id = auth.uid())
  );

create policy "reviews_insert_own_completed_booking"
  on public.reviews for insert
  with check (
    client_id = auth.uid()
    and booking_id in (select id from public.bookings where client_id = auth.uid() and status = 'completed')
  );

-- No authenticated UPDATE policy: moderation (is_published toggle) is
-- admin/service-role only (TRD 3.1.9: "UPDATE: admin only").

-- braider_profiles.avg_rating / total_reviews are documented as "computed;
-- updated on new review" (TRD 3.1.2) but the TRD doesn't say how — wiring it
-- as a trigger here rather than leaving it to application code, so rating
-- integrity doesn't depend on every write path remembering to recompute it.
-- SECURITY DEFINER lets it update braider_profiles despite the owner-only
-- policy and the privileged-field guard trigger on that table (the reviewer
-- is a client, not the braider).
create or replace function public.recompute_braider_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_braider_id uuid := coalesce(new.braider_id, old.braider_id);
begin
  update public.braider_profiles
  set avg_rating = (
        select round(avg(rating)::numeric, 2)
        from public.reviews
        where braider_id = v_braider_id and is_published = true
      ),
      total_reviews = (
        select count(*) from public.reviews
        where braider_id = v_braider_id and is_published = true
      )
  where id = v_braider_id;
  return null;
end;
$$;

create trigger recompute_rating_on_review_change
  after insert or update or delete on public.reviews
  for each row execute function public.recompute_braider_rating();
