-- R-04 follow-up — record HOW a violation report arrived, and stop the same
-- violation being counted twice when it arrives by both routes.
--
-- WHY THIS IS NEEDED
-- Confirmed against a REAL Chrome (not the embedded browser) on 2026-09-01:
-- the CSP fires correctly and Chrome queues the reports — a ReportingObserver
-- with `buffered: true` sees them, correctly typed — but Chrome never flushes
-- them out-of-band. Zero POSTs reached /api/csp-report across a deliberate
-- violation, a navigation, a wait, and a navigation back. Detection works;
-- delivery does not.
--
-- So the page now also reports its own violations, via ReportingObserver,
-- with an ordinary same-origin fetch. The out-of-band configuration
-- (report-uri + report-to + Reporting-Endpoints) is deliberately LEFT IN
-- PLACE: if a browser does start delivering, that is a bonus, and the two
-- paths must not fight.
--
-- Which means the same violation can arrive twice, so:
--
--   `source`        — which path a row came from. Inferred server-side from
--                     the request's Content-Type, never taken from a field in
--                     the payload, so a caller cannot mislabel its own rows.
--                     Its real purpose is to answer, in a week, "did
--                     out-of-band delivery ever actually work?" — which is a
--                     question about the browser, not about Braidr.
--
--   `dedupe_bucket` — the report's arrival time floored to the minute,
--                     computed by the route. Together with the unique index
--                     below it makes a repeat of the same violation within
--                     the same minute a no-op, whichever path it came by.
--
-- Why a bucket column rather than a generated one: Postgres requires a
-- generated column's expression to be IMMUTABLE, and date_trunc over
-- timestamptz is only STABLE (it depends on the session TimeZone). Computing
-- it in the route sidesteps that without needing a UTC-pinned expression.
--
-- KNOWN, ACCEPTED IMPRECISION: two deliveries of one violation that straddle
-- a minute boundary (10:00:59.9 and 10:01:00.1) land in different buckets and
-- both store. A coarser bucket would close that gap but would also throw away
-- the volume signal we are collecting this data to read. A minute keeps
-- per-minute granularity — plenty for ranking which directives and origins
-- fire most — and incidentally caps what a runaway violation loop can write.

alter table public.csp_violation_reports
  add column source text not null default 'out_of_band'
    check (source in ('out_of_band', 'observer')),
  add column dedupe_bucket timestamptz;

-- NULLS NOT DISTINCT matters here: blocked_uri is legitimately empty when the
-- browser withholds it cross-origin, and document_uri is absent on some
-- payload shapes. Under the default NULLS DISTINCT those rows would never
-- collide and would never dedupe — precisely the common case.
create unique index csp_reports_dedupe
  on public.csp_violation_reports (effective_directive, blocked_uri, document_uri, dedupe_bucket)
  nulls not distinct;

create index idx_csp_reports_source on public.csp_violation_reports (source, created_at desc);

comment on column public.csp_violation_reports.source is
  'How the report reached us: ''observer'' = posted by the page''s own '
  'ReportingObserver (components/security/csp-reporter.tsx); ''out_of_band'' '
  '= delivered by the browser itself via report-uri / Reporting-Endpoints. '
  'Inferred from Content-Type server-side, never trusted from the payload. '
  'As of 2026-09-01 real Chrome delivered NOTHING out-of-band, so a run of '
  'rows that are all ''observer'' is expected, not a bug.';
