import type { NextRequest } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { ok, fail } from "@/lib/api/response";
import { checkRateLimit, clientIp, identifierForEmail } from "@/lib/api/rate-limit";
import { sendGoogleSignInNotice } from "@/lib/email/google-sign-in-notice";

// POST /api/auth/reset-password — TRD 4.2 / v2.0 §4.1.
// FR-AUTH-01.5: reset link expiry of 1 hour is a Supabase Auth project
// setting. FR-AUTH-02.6: a Google-only account can't use a password reset.
//
// R-08 — THIS ENDPOINT USED TO ANSWER A QUESTION IT SHOULD NOT HAVE.
// It returned `{ sent: false, google_only: true }` for an address that
// belongs to a Google-only account, and `{ sent: true }` for everything else.
// The second case is correctly ambiguous — a registered password account and
// an address nobody has ever used look identical. The first was not: it
// confirmed, to an anonymous caller, that a specific address is a Braidr
// account. The help it provided was real, so it has been moved into an email
// (lib/email/google-sign-in-notice.ts) rather than removed: the person who
// controls the mailbox still learns to use Google, and nobody else learns
// anything.
//
// EVERY PATH NOW RETURNS `{ sent: true }`, AND MUST COST THE SAME.
// A uniform body is not enough on its own — if the Google-only branch sent an
// email inline and the others didn't, response time would rebuild the oracle
// the body no longer leaks. So the work that differs happens in `after()`,
// which runs once the response has already been sent. What happens before the
// response is identical on all three paths: the same two rate-limit checks,
// the same RPC, the same client construction.
export async function POST(request: NextRequest) {
  const ipLimited = await checkRateLimit("auth", clientIp(request));
  if (!ipLimited.success) {
    return fail("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  const parsed = validate(resetPasswordSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { email } = parsed.data;

  // Per-address limit, on top of the per-IP one above. The IP bucket does not
  // stop mailbox-bombing: a caller with many addresses (or many IPs) can aim
  // all of them at one inbox. This bucket is keyed by the target, so the
  // victim's mailbox is what's protected. A 429 here reveals only that
  // somebody recently asked about this address — which the caller already
  // knows, because they are the one asking — and it fires identically whether
  // or not the address is registered.
  const emailLimited = await checkRateLimit("authEmail", identifierForEmail(email));
  if (!emailLimited.success) {
    return fail("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  const admin = createAdminClient();
  const { data: googleOnly } = await admin.rpc("email_is_google_only", { p_email: email });

  // Built here, used inside after(). resetPasswordForEmail sets no session, so
  // only the construction needs the request's cookies — and doing it up front
  // keeps the pre-response cost the same on every path.
  const supabase = await createClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`;

  after(async () => {
    // Logged on both sides: if `after` ever stops running on this platform,
    // the only symptom would be reset emails silently not arriving, and the
    // absence of these lines is what makes that visible.
    console.info("[reset-password] post-response delivery starting", {
      google_only: Boolean(googleOnly),
    });
    try {
      if (googleOnly) {
        await sendGoogleSignInNotice(email);
      } else {
        // Supabase sends nothing for an address it doesn't know, which is
        // exactly the behaviour we want: one code path, two outcomes, no
        // difference visible from outside.
        await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      }
      console.info("[reset-password] post-response delivery done");
    } catch (e) {
      console.error("[reset-password] post-response delivery FAILED", e);
    }
  });

  return ok({ sent: true });
}
