import { createHash, timingSafeEqual } from "crypto";
import { fail } from "@/lib/api/response";

// R-07 — the shared bearer-token gate for every /api/cron/* route.
//
// WHAT WAS WRONG
// Each of the eight routes inlined this comparison:
//
//   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)
//
// When CRON_SECRET is unset, the template literal interpolates the string
// "undefined", so the header `Bearer undefined` MATCHES and the route runs.
// That is not a theoretical bypass: these routes hard-delete accounts
// (account-deletion), release braider payouts (release-payouts), cancel
// bookings (expire-stale-bookings) and send email (newsletter). A missing
// env var silently converted all of them into unauthenticated endpoints on
// a public repo with published route paths.
//
// WHY IT COULD NEVER BE NOTICED
// This is the failure mode with no observable symptom. The Netlify scheduled
// functions send `Bearer ${process.env.CRON_SECRET}` — reading the SAME
// variable. Unset, they send "Bearer undefined" and the route accepts
// "Bearer undefined". Configured, they send the real token and the route
// accepts the real token. The crons succeed either way, and the logs look
// identical. Nothing anywhere distinguishes "locked" from "wide open".
//
// The fix restores that distinction: unset is now a 500 the scheduled
// function logs, so the state is legible from the outside for the first time.
//
// Returns a response to send when the caller is NOT authorised, or null when
// it is. Callers must `return` it — the null check is the whole gate.
export function rejectUnauthorisedCron(request: Request): ReturnType<typeof fail> | null {
  const secret = process.env.CRON_SECRET;

  // Fail CLOSED. An unset secret is a deployment fault, not an anonymous
  // caller's fault, so it is a 500 rather than a 401 — the distinction is
  // what makes the misconfiguration diagnosable from the scheduled
  // function's logged status code.
  if (!secret) {
    console.error(
      "[cron] CRON_SECRET is not set. Refusing to run — every /api/cron/* route " +
        "is returning 500 until it is configured in the deploy environment."
    );
    // Deliberately generic to the caller: an anonymous requester learns that
    // cron is unavailable, not which variable is missing. The detail is in
    // the server log above.
    return fail("INTERNAL_ERROR", "Cron is not configured.", 500);
  }

  const header = request.headers.get("authorization");
  if (!header || !constantTimeEquals(header, `Bearer ${secret}`)) {
    return fail("UNAUTHENTICATED", "Not authorized.", 401);
  }

  return null;
}

// `!==` on secrets short-circuits at the first differing byte, so how long it
// takes to reject leaks how much of the prefix was right. Remote timing
// attacks over HTTPS are impractical in practice, but constant-time is two
// lines here and removes the question.
//
// Comparing SHA-256 digests rather than the raw strings keeps both operands
// the same length: timingSafeEqual throws on a length mismatch, and guarding
// that with an early `length !==` return would leak the secret's length.
function constantTimeEquals(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a, "utf8").digest(),
    createHash("sha256").update(b, "utf8").digest()
  );
}
