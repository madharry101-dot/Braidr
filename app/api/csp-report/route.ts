import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/api/rate-limit";

// POST /api/csp-report — collection point for Content-Security-Policy
// violation reports while the policy runs in Report-Only mode (R-04).
//
// THIS ENDPOINT IS UNAUTHENTICATED, AND HAS TO BE. Browsers post violation
// reports with no cookies and no session; requiring auth would mean
// collecting nothing. That makes it a public write endpoint, so it is
// deliberately defensive:
//
//   - rate limited per IP (cspReport group)
//   - request body capped before it is parsed, not after
//   - a FIXED set of fields is extracted and every string truncated, so an
//     attacker cannot use it to store arbitrary volumes of arbitrary content
//   - always answers 204 with no body, whatever happened — a reporting
//     endpoint that returns errors or detail is just an oracle, and browsers
//     ignore the response anyway
//
// Two wire formats exist and browsers disagree about which to send: the
// legacy `report-uri` shape (application/csp-report, a single {"csp-report":
// {...}}) and the Reporting API shape (application/reports+json, an ARRAY of
// {type, body, ...}). Both are handled — dropping either would silently lose
// whole browser families from the sample, which defeats the point of
// gathering evidence before enforcing.

const MAX_BODY_BYTES = 16 * 1024;
const MAX_REPORTS_PER_REQUEST = 20;

function truncate(value: unknown, max: number): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function toInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

type Row = {
  document_uri: string | null;
  violated_directive: string | null;
  effective_directive: string | null;
  blocked_uri: string | null;
  source_file: string | null;
  line_number: number | null;
  column_number: number | null;
  disposition: string | null;
  user_agent: string | null;
  raw: unknown;
  source: "observer" | "out_of_band";
  dedupe_bucket: string;
};

/**
 * Which delivery path this request came by, decided from the Content-Type
 * rather than from anything in the payload — a caller cannot mislabel its own
 * rows by setting a field. Browsers use `application/csp-report` (legacy
 * report-uri) or `application/reports+json` (Reporting API); the page's own
 * ReportingObserver posts ordinary `application/json`.
 *
 * This exists to answer one question later: did out-of-band delivery ever
 * actually start working? As of 2026-09-01 real Chrome sent nothing.
 */
function inferSource(contentType: string | null): "observer" | "out_of_band" {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("csp-report") || ct.includes("reports+json")) return "out_of_band";
  return "observer";
}

/** Normalises either wire format's report body into one row shape. */
function toRow(
  body: Record<string, unknown>,
  userAgent: string | null,
  source: "observer" | "out_of_band",
  dedupeBucket: string
): Row {
  return {
    source,
    dedupe_bucket: dedupeBucket,
    document_uri: truncate(body["document-uri"] ?? body.documentURL, 1000),
    violated_directive: truncate(body["violated-directive"], 200),
    effective_directive: truncate(
      body["effective-directive"] ?? body.effectiveDirective ?? body["violated-directive"],
      200
    ),
    blocked_uri: truncate(body["blocked-uri"] ?? body.blockedURL, 1000),
    source_file: truncate(body["source-file"] ?? body.sourceFile, 1000),
    line_number: toInt(body["line-number"] ?? body.lineNumber),
    column_number: toInt(body["column-number"] ?? body.columnNumber),
    disposition: truncate(body.disposition, 32),
    user_agent: truncate(userAgent, 500),
    raw: body,
  };
}

export async function POST(request: NextRequest) {
  // Answer 204 on every path below. Nothing about why a report was dropped
  // is useful to the sender, and browsers discard the response regardless.
  const noContent = new Response(null, { status: 204 });

  const rateLimit = await checkRateLimit("cspReport", clientIp(request));
  if (!rateLimit.success) return noContent;

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) return noContent;

  let text: string;
  try {
    text = await request.text();
  } catch {
    return noContent;
  }
  // content-length is a claim, not a fact — check the real thing too.
  if (text.length === 0 || text.length > MAX_BODY_BYTES) return noContent;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return noContent;
  }

  const userAgent = request.headers.get("user-agent");
  const source = inferSource(request.headers.get("content-type"));
  // Arrival time floored to the minute. With the csp_reports_dedupe unique
  // index this makes a repeat of the same violation inside the same minute a
  // no-op — which matters because the out-of-band config is deliberately
  // still enabled, so one violation could arrive by both paths.
  const dedupeBucket = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const rows: Row[] = [];

  if (Array.isArray(parsed)) {
    // Reporting API: [{ type: "csp-violation", body: {...} }, ...]
    // Also the shape the page's own observer posts, which sends the report
    // bodies directly — hence the `e.body ?? e` fallback below.
    for (const entry of parsed.slice(0, MAX_REPORTS_PER_REQUEST)) {
      if (entry && typeof entry === "object") {
        const e = entry as Record<string, unknown>;
        if (e.type && e.type !== "csp-violation") continue;
        const body = (e.body ?? e) as Record<string, unknown>;
        if (body && typeof body === "object") {
          rows.push(toRow(body, userAgent, source, dedupeBucket));
        }
      }
    }
  } else if (parsed && typeof parsed === "object") {
    // Legacy report-uri: { "csp-report": {...} }
    const p = parsed as Record<string, unknown>;
    const body = (p["csp-report"] ?? p) as Record<string, unknown>;
    if (body && typeof body === "object") {
      rows.push(toRow(body, userAgent, source, dedupeBucket));
    }
  }

  if (rows.length === 0) return noContent;

  // A batch can legitimately contain the same violation twice (an observer
  // flush plus a buffered replay). Collapse within the request as well, so a
  // single insert can't conflict with itself.
  const deduped = [
    ...new Map(
      rows.map((r) => [`${r.effective_directive}|${r.blocked_uri}|${r.document_uri}`, r])
    ).values(),
  ];

  try {
    // ignoreDuplicates -> ON CONFLICT DO NOTHING against csp_reports_dedupe.
    await createAdminClient().from("csp_violation_reports").upsert(deduped, {
      onConflict: "effective_directive,blocked_uri,document_uri,dedupe_bucket",
      ignoreDuplicates: true,
    });
  } catch {
    // Losing a violation report must never surface as a client-visible error.
  }

  return noContent;
}
