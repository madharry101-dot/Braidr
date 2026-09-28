import { sendGoogleSignInNotice } from "@/lib/email/google-sign-in-notice";

// R-08. The half of POST /api/auth/reset-password that differs per account,
// lifted out of the route so it can actually be tested.
//
// It runs inside `after()`, i.e. once the response has already gone out. That
// is what keeps the three paths indistinguishable: a uniform response body is
// not enough on its own, because sending the Google notice inline would
// rebuild the oracle in response time.
//
// Being post-response has a cost worth naming: nothing is waiting on the
// result, so a failure here is invisible unless it says so. Hence the
// bracketing log lines — if `after()` ever stops running on the platform, the
// only symptom would be reset emails quietly not arriving, and the ABSENCE of
// "starting" is what makes that visible. A throw is caught and logged at
// error level rather than left to become an unhandled rejection.

/** The one method this needs from a Supabase client — narrowed so tests need no SDK. */
export type PasswordResetClient = {
  auth: {
    resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<unknown>;
  };
};

export async function deliverPasswordReset(params: {
  email: string;
  googleOnly: boolean;
  supabase: PasswordResetClient;
  redirectTo: string;
}): Promise<void> {
  const { email, googleOnly, supabase, redirectTo } = params;

  console.info("[reset-password] post-response delivery starting", { google_only: googleOnly });
  try {
    if (googleOnly) {
      await sendGoogleSignInNotice(email);
    } else {
      // Supabase sends nothing for an address it doesn't know, which is
      // exactly what we want: one code path, two outcomes, no difference
      // visible from outside.
      await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    }
    console.info("[reset-password] post-response delivery done", { google_only: googleOnly });
  } catch (e) {
    // Nothing is awaiting this. If it is not logged, it did not happen as far
    // as anyone can tell.
    console.error("[reset-password] post-response delivery FAILED", {
      google_only: googleOnly,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
