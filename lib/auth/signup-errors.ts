// R-08 — what /api/auth/register is allowed to say back to an anonymous caller.
//
// The route used to return Supabase's raw `error.message` under the email
// field. That message is not ours to control, and in a project with email
// confirmation DISABLED, Supabase answers a signup for an existing address
// with "User already registered" — turning registration into an
// account-existence oracle for anyone who can POST a form.
//
// MEASURED ON THIS PROJECT (2026-09-28, probe against the live Supabase):
// signUp() with an existing, confirmed address returns NO error at all — a
// fake user id, `identities: []`, no session. That is Supabase's own
// anti-enumeration obfuscation, and it is active **only while "Confirm
// email" is on in the project settings**. So today the leak is closed, but
// it is closed by a dashboard toggle that anyone can flip in a UI with no
// code review, not by anything in this repository.
//
// This module moves the guarantee into code: an "already registered" result
// is converted to the ordinary success response, so registration answers
// identically whether or not the address is known, in either configuration.

/** Supabase error codes that mean "this address already has an account". */
const ALREADY_REGISTERED_CODES = new Set(["user_already_exists", "email_exists"]);

/**
 * Errors safe to show verbatim-ish: they describe what the CALLER typed, not
 * what the database contains, so they reveal nothing about who is registered.
 * Anything not listed here collapses to a single generic message.
 */
const SAFE_MESSAGES: Record<string, { message: string; field: string }> = {
  email_address_invalid: {
    message: "That email address doesn't look valid. Please check it and try again.",
    field: "email",
  },
  weak_password: {
    message: "Please choose a stronger password.",
    field: "password",
  },
  over_email_send_rate_limit: {
    message: "Too many attempts. Please try again in a few minutes.",
    field: "email",
  },
  signup_disabled: {
    message: "New registrations are currently closed.",
    field: "email",
  },
};

const GENERIC = {
  message: "We couldn't complete your registration. Please try again.",
  field: "email" as const,
};

export type SignUpErrorLike = { code?: string; message?: string } | null | undefined;

/**
 * True when Supabase is telling us the address is already registered.
 * Checks the message as well as the code because older GoTrue versions
 * returned the message without a machine-readable code.
 */
export function isAlreadyRegistered(error: SignUpErrorLike): boolean {
  if (!error) return false;
  if (error.code && ALREADY_REGISTERED_CODES.has(error.code)) return true;
  return /already\s+registered|already\s+exists/i.test(error.message ?? "");
}

/** Maps a signUp error to what the caller is allowed to see. */
export function publicSignUpError(error: SignUpErrorLike): { message: string; field: string } {
  if (!error?.code) return GENERIC;
  return SAFE_MESSAGES[error.code] ?? GENERIC;
}
