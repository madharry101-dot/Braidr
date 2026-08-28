import type { createAdminClient } from "@/lib/supabase/admin";
import type { ConsentType } from "@/types/database";

type ConsentRow = {
  consent_type: ConsentType;
  consent_version: string;
  granted: boolean;
};

/**
 * Appends consent_events rows for a user, via the service-role client.
 *
 * Used where consent is captured before a session exists — the registration
 * handler (email confirmation may be pending) and the OAuth completion
 * handler. For consent given by an already-signed-in user (cookie banner,
 * BraidCare, withdrawals), use POST /api/settings/consent instead, which
 * runs under the user's own RLS.
 *
 * Best-effort: a consent-log write must never block account creation, but a
 * failure is logged loudly because the log is the GDPR accountability
 * evidence (TRD v2.0 §6.4).
 */
export async function recordConsent(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  ipAddress: string | null,
  events: ConsentRow[]
): Promise<void> {
  if (events.length === 0) return;
  const { error } = await admin.from("consent_events").insert(
    events.map((e) => ({
      user_id: userId,
      consent_type: e.consent_type,
      consent_version: e.consent_version,
      granted: e.granted,
      ip_address: ipAddress,
    }))
  );
  if (error) {
    console.error(`[consent] failed to record ${events.length} event(s) for ${userId}`, error);
  }
}
