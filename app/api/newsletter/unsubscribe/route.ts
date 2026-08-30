import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NEWSLETTER_VERSION } from "@/lib/consent/versions";
import { ok, fail } from "@/lib/api/response";

// POST /api/newsletter/unsubscribe — withdraw by token, WITHOUT logging in.
//
// PECR reg. 23 requires a working opt-out in every marketing message, and
// requiring a login to use it would not be one. Runs on the service-role
// client for exactly that reason: there is no session to run under.
//
// The token is the only credential, so this route is deliberately narrow —
// it can set unsubscribed_at on one row and nothing else. It returns the
// same response for a valid and an unknown token, so it can't be used to
// probe which tokens exist.
export async function POST(request: NextRequest) {
  let token: string | null = null;
  try {
    const body = (await request.json()) as { token?: unknown };
    if (typeof body.token === "string") token = body.token.trim();
  } catch {
    /* fall through to the 422 below */
  }
  if (!token || token.length < 16 || token.length > 128) {
    return fail("VALIDATION_ERROR", "An unsubscribe token is required.", 422, "token");
  }

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("newsletter_subscriptions")
    .select("id, user_id, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  // Unknown token, or already unsubscribed: report success either way.
  // Someone clicking an old link should be told they're unsubscribed, which
  // is true, and an attacker learns nothing from the response.
  if (!sub) return ok({ unsubscribed: true });
  if (sub.unsubscribed_at) return ok({ unsubscribed: true });

  const { error } = await admin
    .from("newsletter_subscriptions")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", sub.id);
  if (error) {
    console.error("[newsletter] token unsubscribe failed", error);
    return fail("INTERNAL_ERROR", "Couldn't unsubscribe you. Please try again.", 500);
  }

  const { error: logError } = await admin.from("consent_events").insert({
    user_id: sub.user_id,
    consent_type: "newsletter",
    consent_version: NEWSLETTER_VERSION,
    granted: false,
    ip_address:
      request.headers.get("x-nf-client-connection-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      null,
  });
  if (logError) console.error("[newsletter] consent log failed", logError);

  return ok({ unsubscribed: true });
}
