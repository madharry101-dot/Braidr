-- PART 3 — Newsletter.
--
-- COMPLIANCE POSTURE (UK PECR reg. 22 + UK GDPR art. 7). This is marketing
-- mail, not transactional, so it requires an affirmative opt-in:
--
--   * The column default is FALSE-equivalent — a row only exists once
--     someone has opted in. No account is subscribed by its own creation.
--   * subscribed_at IS the consent record: when they said yes.
--   * consent_source records where they said it, so a "how did you get my
--     address" request can be answered concretely.
--   * unsubscribe_token allows withdrawal without logging in, which
--     PECR reg. 23 requires of every marketing message.
--
-- Deliberately NOT wired into profiles.notification_preferences, which is
-- the opt-OUT model used for transactional mail (booking confirmed,
-- appointment reminder, BraidCare unlocked). Mixing the two is how a
-- transactional default silently becomes marketing consent.
--
-- Accounts only for this pass (founder decision): user_id is NOT NULL, so
-- there is no email-only signup path and therefore no way to subscribe an
-- address its owner does not control. A public blog signup form would need
-- double opt-in before it ships.

create table public.newsletter_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.profiles(id) on delete cascade,
  -- The consent record. Reset on every fresh opt-in so it always answers
  -- "when did they most recently agree".
  subscribed_at     timestamptz not null default now(),
  unsubscribed_at   timestamptz,
  consent_source    text not null check (consent_source in (
                      'settings_page',
                      'blog_signup_form',
                      'registration'
                    )),
  -- Login-free unsubscribe. Random, unguessable, and rotated on resubscribe
  -- so an old link in an old email cannot be replayed against a new
  -- subscription.
  unsubscribe_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_newsletter_active on public.newsletter_subscriptions (unsubscribed_at)
  where unsubscribed_at is null;

create trigger set_newsletter_subscriptions_updated_at
  before update on public.newsletter_subscriptions
  for each row execute function public.set_updated_at();

alter table public.newsletter_subscriptions enable row level security;

create policy "newsletter_select_own"
  on public.newsletter_subscriptions for select
  using (user_id = auth.uid());

create policy "newsletter_insert_own"
  on public.newsletter_subscriptions for insert
  with check (user_id = auth.uid());

create policy "newsletter_update_own"
  on public.newsletter_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No DELETE policy: withdrawing sets unsubscribed_at rather than removing
-- the row, because the record of consent having been given (and withdrawn)
-- is itself the accountability evidence. Rows leave only with the account.

-- The full history — subscribe, unsubscribe, resubscribe — lives in
-- consent_events, which is append-only. The table above is current state;
-- consent_events is the audit trail, and 'newsletter' is added to its
-- allowed types here.
alter table public.consent_events drop constraint consent_events_consent_type_check;
alter table public.consent_events add constraint consent_events_consent_type_check
  check (consent_type in (
    'terms_and_privacy',
    'marketing',
    'cookies_analytics',
    'braidcare_photo_processing',
    'expert_referral_share',
    'newsletter'
  ));

-- ── send queue ──────────────────────────────────────────────────────────
-- Publishing a post enqueues one row per subscriber; a cron drains it in
-- batches. Queued rather than sent inline so publishing stays instant, a
-- failure is retryable, and there is a per-recipient record of what was
-- actually delivered.
create table public.newsletter_sends (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.blog_posts(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  status            text not null default 'queued'
                      check (status in ('queued', 'sent', 'failed')),
  attempts          integer not null default 0,
  last_error        text,
  sent_at           timestamptz,
  created_at        timestamptz not null default now(),
  -- The double-send guard. Re-running the enqueue for a post (a retried
  -- publish, an unpublish/republish) cannot produce a second email to
  -- someone who already has one.
  unique (post_id, recipient_user_id)
);

create index idx_newsletter_sends_queue on public.newsletter_sends (status, created_at)
  where status = 'queued';

alter table public.newsletter_sends enable row level security;
-- No authenticated policy at all: written by the publish route and drained
-- by the cron, both on the service-role client. Same posture as
-- income_records and content_moderation_log.
