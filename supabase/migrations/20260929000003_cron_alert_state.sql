-- R-04 follow-up — remember when an alert last went out.
--
-- `csp_violation_reports` has been collecting since the CSP went enforcing,
-- and nothing has ever looked at it. In enforce mode a row there means
-- something was actually BLOCKED for a real user, so the table is a signal,
-- not a dataset — and a signal nobody reads is not a signal.
--
-- WHY A WATERMARK RATHER THAN "rows in the last 24 hours".
-- A fixed lookback double-reports if the cron runs twice and loses everything
-- if it misses a day. `last_alerted_at` is both the point new rows are counted
-- from AND the throttle, which is what makes a noisy day produce one email
-- instead of one per run: alerting moves the watermark, so the next run has
-- nothing new to say.
--
-- Deliberately generic (`alert_key`) so the next thing worth alerting on does
-- not need another table.

create table if not exists public.cron_alert_state (
  alert_key       text primary key,
  last_alerted_at timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.cron_alert_state is
  'Watermark per alert stream: when that alert last actually sent. Written only by the service role from the daily cron.';

-- RLS on with NO policies, matching csp_violation_reports and
-- stripe_webhook_events. The service role bypasses RLS; nobody else has any
-- business here.
alter table public.cron_alert_state enable row level security;

revoke all on public.cron_alert_state from anon, authenticated;
