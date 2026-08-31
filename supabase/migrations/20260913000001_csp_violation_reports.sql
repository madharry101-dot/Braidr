-- R-04 — storage for Content-Security-Policy violation reports.
--
-- The CSP ships in Report-Only mode first. Real browsers on real traffic tell
-- us what the policy would actually have blocked, and the enforcing policy is
-- then built from what genuinely fires rather than from what we believe loads.
-- Reports need somewhere queryable to land for that to be possible.
--
-- SECURITY NOTE ON THE ENDPOINT THAT WRITES HERE
-- Browsers post violation reports with no cookies and no session, so
-- POST /api/csp-report is necessarily unauthenticated. That makes it a public
-- write endpoint — an abuse vector in its own right, and the reason the route
-- rate-limits per IP, caps the body size, stores a fixed set of fields rather
-- than whatever JSON arrives, and truncates every string it keeps.
--
-- RLS is enabled with NO policies at all. That is deliberate and means
-- exactly what it looks like: neither `anon` nor `authenticated` can read or
-- write this table by any path. Inserts happen through the service-role
-- client in the route; reads happen through the service-role client in the
-- admin surface. There is no reason for a browser to ever touch it directly.

create table public.csp_violation_reports (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),

  -- The page that generated the violation.
  document_uri        text,
  -- e.g. "script-src-elem"; `effective_directive` is the modern field name
  -- and `violated_directive` the legacy one — browsers differ, keep both.
  violated_directive  text,
  effective_directive text,
  -- What was blocked. Often an origin; can be "inline", "eval", or "" when
  -- the browser withholds it cross-origin.
  blocked_uri         text,
  -- Where in our own code it originated, when the browser tells us.
  source_file         text,
  line_number         integer,
  column_number       integer,
  -- "report" while in Report-Only, "enforce" once we switch over. Keeping it
  -- means the same table stays useful after enforcement without ambiguity
  -- about which mode a row came from.
  disposition         text,
  user_agent          text,
  -- The trimmed original, for anything the columns above didn't capture.
  raw                 jsonb
);

alter table public.csp_violation_reports enable row level security;

-- Deliberately no policies. See the note above.

-- The two questions this table exists to answer are "what is firing, and how
-- often" and "is it still firing since I changed the policy", so index for
-- grouping by directive and for recency.
create index idx_csp_reports_directive on public.csp_violation_reports (effective_directive, blocked_uri);
create index idx_csp_reports_created on public.csp_violation_reports (created_at desc);

comment on table public.csp_violation_reports is
  'CSP violation reports collected while the policy runs in Report-Only mode. '
  'Written only by the service-role client from POST /api/csp-report; RLS is '
  'enabled with no policies so no browser role can reach it. Rows are '
  'operational data, not user data — but blocked_uri and document_uri can '
  'contain URLs a user visited, so treat it as access-log-grade and purge it '
  'once the enforcing policy is settled.';
