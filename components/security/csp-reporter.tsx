"use client";

import { useEffect } from "react";

/**
 * Posts this page's own CSP violations to /api/csp-report.
 *
 * WHY THIS EXISTS — the browser is supposed to do this itself.
 *
 * The policy declares both `report-uri` and `report-to`, and the response
 * carries `Reporting-Endpoints`. Confirmed against a REAL Chrome on
 * 2026-09-01 (not the embedded browser — that showed the same symptom, but
 * was not evidence): the policy fires correctly, and Chrome *queues* the
 * reports — a ReportingObserver with `buffered: true` sees them, correctly
 * typed — but Chrome never flushes them out-of-band. Zero POSTs arrived
 * across a deliberate violation, a navigation, a wait, and a navigation back.
 *
 * Detection works. Delivery does not. So the page delivers them itself, with
 * an ordinary same-origin fetch.
 *
 * The out-of-band configuration is deliberately LEFT IN PLACE. If a browser
 * does start delivering, that is a bonus rather than a conflict: the server
 * tags each row with the path it arrived by, and a unique index collapses the
 * same violation arriving twice within a minute.
 *
 * `buffered: true` is essential, not incidental. Violations fire during the
 * initial page load — before React has hydrated and long before this effect
 * runs — so an unbuffered observer would miss exactly the ones that matter
 * most. It is also what made the original diagnosis possible.
 *
 * This component renders nothing and never throws into the page: a
 * diagnostics channel must not be able to break the site it is measuring.
 */

const ENDPOINT = "/api/csp-report";
/** Matches MAX_REPORTS_PER_REQUEST in the route. */
const MAX_PER_BATCH = 20;
/** A page with a violation in a render loop must not become a POST loop. */
const MAX_PER_PAGE = 50;

type Reportish = Record<string, unknown>;

export function CspReporter() {
  useEffect(() => {
    let sent = 0;
    // Same key the server dedupes on, applied here too so a page that trips
    // the same violation repeatedly sends it once rather than every time.
    const seen = new Set<string>();

    function keyOf(body: Reportish): string {
      return [
        body.effectiveDirective ?? body["effective-directive"] ?? "",
        body.blockedURL ?? body["blocked-uri"] ?? "",
        body.documentURL ?? body["document-uri"] ?? "",
      ].join("|");
    }

    function post(bodies: Reportish[]) {
      if (bodies.length === 0 || sent >= MAX_PER_PAGE) return;
      const batch = bodies.slice(0, MAX_PER_BATCH);
      sent += batch.length;
      // application/json is what tags these as `source = 'observer'` server
      // side — browsers use application/csp-report or reports+json. Same
      // origin, so connect-src 'self' allows it and this cannot itself
      // trigger the violation it is reporting.
      void fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        // The page may be unloading when a violation lands; keepalive lets
        // the request outlive it. This is the failure mode that appears to
        // defeat Chrome's own out-of-band delivery.
        keepalive: true,
      }).catch(() => {
        // Deliberately silent. Reporting is best-effort telemetry.
      });
    }

    function collect(bodies: Reportish[]) {
      const fresh: Reportish[] = [];
      for (const body of bodies) {
        if (!body) continue;
        const key = keyOf(body);
        if (seen.has(key)) continue;
        seen.add(key);
        fresh.push(body);
      }
      post(fresh);
    }

    let observer: ReportingObserver | undefined;
    let listener: ((e: SecurityPolicyViolationEvent) => void) | undefined;

    try {
      if (typeof ReportingObserver !== "undefined") {
        observer = new ReportingObserver(
          (reports) => collect(reports.map((r) => r.body as unknown as Reportish)),
          // buffered: true replays violations that fired before this ran —
          // see the note above; without it the page-load violations are lost.
          { types: ["csp-violation"], buffered: true }
        );
        observer.observe();
      } else {
        // Safari and Firefox have no ReportingObserver. The DOM event carries
        // the same information under different property names, which the
        // server already normalises.
        listener = (e: SecurityPolicyViolationEvent) =>
          collect([
            {
              "document-uri": e.documentURI,
              "violated-directive": e.violatedDirective,
              "effective-directive": e.effectiveDirective,
              "blocked-uri": e.blockedURI,
              "source-file": e.sourceFile,
              "line-number": e.lineNumber,
              "column-number": e.columnNumber,
              disposition: e.disposition,
            },
          ]);
        document.addEventListener("securitypolicyviolation", listener);
      }
    } catch {
      // A browser that dislikes any of the above simply reports nothing.
    }

    return () => {
      try {
        observer?.disconnect();
        if (listener) document.removeEventListener("securitypolicyviolation", listener);
      } catch {
        /* nothing useful to do on teardown */
      }
    };
  }, []);

  return null;
}
