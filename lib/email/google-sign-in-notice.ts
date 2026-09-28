import { sendEmail } from "@/lib/email/send";

// R-08. Sent when someone asks to reset the password on an account that was
// created with Google and therefore has no password.
//
// The information itself is genuinely useful — without it, a Google-only user
// asks for a reset link, is told to check their email, and waits for a message
// that is never coming. It used to be delivered in the HTTP response
// (`google_only: true`), which meant anyone could ask the API whether a given
// address was a Google Braidr account. Moving it into an email keeps the help
// and removes the oracle: only the person who controls the mailbox sees it.
export async function sendGoogleSignInNotice(email: string): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://braidr.netlify.app";

  await sendEmail({
    to: email,
    subject: "Signing in to Braidr",
    text: [
      "You asked to reset the password for your Braidr account.",
      "",
      "This account was created with Google, so there's no password to reset.",
      'Choose "Continue with Google" on the sign-in page instead.',
      "",
      `Sign in: ${siteUrl}/login`,
      "",
      "If you didn't ask for this, you can ignore this email — nothing about",
      "your account has changed.",
    ].join("\n"),
  });
}
