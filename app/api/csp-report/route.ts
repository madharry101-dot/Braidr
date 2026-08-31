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
};

/** Normalises either wire format's report body into one row shape. */
function toRow(body: Record<string, unknown>, userAgent: string | null): Row {
  return {
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
  const rows: Row[] = [];

  if (Array.isArray(parsed)) {
    // Reporting API: [{ type: "csp-violation", body: {...} }, ...]
    for (const entry of parsed.slice(0, MAX_REPORTS_PER_REQUEST)) {
      if (entry && typeof entry === "object") {
        const e = entry as Record<string, unknown>;
        if (e.type && e.type !== "csp-violation") continue;
        const body = (e.body ?? e) as Record<string, unknown>;
        if (body && typeof body === "object") rows.push(toRow(body, userAgent));
      }
    }
  } else if (parsed && typeof parsed === "object") {
    // Legacy report-uri: { "csp-report": {...} }
    const p = parsed as Record<string, unknown>;
    const body = (p["csp-report"] ?? p) as Record<string, unknown>;
    if (body && typeof body === "object") rows.push(toRow(body, userAgent));
  }

  if (rows.length === 0) return noContent;

  try {
    await createAdminClient().from("csp_violation_reports").insert(rows);
  } catch {
    // Losing a violation report must never surface as a client-visible error.
  }

  return noContent;
}
