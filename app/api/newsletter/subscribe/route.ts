import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { subscribeNewsletterSchema } from "@/lib/validations/newsletter";
import { NEWSLETTER_VERSION } from "@/lib/consent/versions";
import { ok, fail } from "@/lib/api/response";

// GET /api/newsletter/subscribe — the caller's own subscription state.
// Absent row = not subscribed. There is no "default on": a row only exists
// because someone opted in.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: sub } = await supabase
    .from("newsletter_subscriptions")
    .select("subscribed_at, unsubscribed_at, consent_source")
    .eq("user_id", user.id)
    .maybeSingle();

  return ok({
    subscribed: Boolean(sub && sub.unsubscribed_at === null),
    subscribed_at: sub?.unsubscribed_at === null ? (sub?.subscribed_at ?? null) : null,
    consent_source: sub?.consent_source ?? null,
  });
}

// PUT /api/newsletter/subscribe — opt in or withdraw.
//
// Both directions append to consent_events, which is append-only, so the
// full subscribe/unsubscribe/resubscribe history survives even though the
// subscriptions table only holds current state. That log is the
// accountability evidence a PECR/GDPR request would be answered from.
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(subscribeNewsletterSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { subscribed, consent_source } = parsed.data;

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("newsletter_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const patch = subscribed
      ? {
          subscribed_at: now,
          unsubscribed_at: null,
          consent_source,
          // Rotate on every fresh opt-in so an unsubscribe link from a
          // previous subscription can't be replayed against this one.
          unsubscribe_token:
            crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().slice(0, 8),
        }
      : { unsubscribed_at: now };
    const { error } = await supabase
      .from("newsletter_subscriptions")
      .update(patch)
      .eq("user_id", user.id);
    if (error) {
      console.error("[newsletter] update failed", error);
      return fail("INTERNAL_ERROR", "Couldn't save your preference.", 500);
    }
  } else {
    if (!subscribed) return ok({ subscribed: false });
    const { error } = await supabase
      .from("newsletter_subscriptions")
      .insert({ user_id: user.id, consent_source, subscribed_at: now });
    if (error) {
      console.error("[newsletter] insert failed", error);
      return fail("INTERNAL_ERROR", "Couldn't save your preference.", 500);
    }
  }

  // Audit trail. Best-effort — never block the user's own preference change
  // on the log write, but shout if it fails, because the log is the evidence.
  const admin = createAdminClient();
  const { error: logError } = await admin.from("consent_events").insert({
    user_id: user.id,
    consent_type: "newsletter",
    consent_version: NEWSLETTER_VERSION,
    granted: subscribed,
    ip_address:
      request.headers.get("x-nf-client-connection-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      null,
  });
  if (logError) console.error("[newsletter] consent log failed", logError);

  return ok({ subscribed });
}
