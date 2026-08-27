import { Resend } from "resend";

// Minimal plain-text sender for the transactional emails this sprint's
// flows need (booking confirmation, reschedule notifications). TRD 2.2
// specifies React Email templates for these — that's a design/content task
// deferred until there's an actual template design to build against; this
// gets the notification plumbing working now without blocking on that.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail(params: { to: string; subject: string; text: string }) {
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — would have sent "${params.subject}" to ${params.to}`
    );
    return;
  }
  await resend.emails.send({
    // Placeholder sender domain — must be a domain verified in Resend
    // before this can actually deliver. Swap via RESEND_FROM_EMAIL once a
    // real domain is bought and verified (see EMAIL_FROM_ADDRESS note in
    // .env.example).
    from: process.env.RESEND_FROM_EMAIL ?? "Braidr <notifications@braidr.app>",
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}
