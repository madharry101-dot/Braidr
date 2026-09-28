# Braidr pre-launch checklist

Things that must be true before Braidr takes real users. Each item says who
found it and how it was established, so nothing here has to be re-derived.

Items marked **BLOCKER** will break the product for real users on day one.
Items marked **CONTROL** are existing protections that must not be switched
off — they are compensating controls for accepted risks, not nice-to-haves.

---

## Email delivery

- [ ] **BLOCKER — move off Supabase's built-in SMTP.**
      Confirmed live on 2026-09-28: auth email is sent from
      `noreply@mail.app.supabase.io`, i.e. Supabase's built-in service. That
      service is explicitly not intended for production and allows only a
      handful of messages per hour.
      **Observed symptom:** a real registration against production returned
      **502 after 11.2s** — Netlify's function timeout — because signup blocks
      on the confirmation email. No user was created and no error reached the
      caller. A retry minutes later returned `over_email_send_rate_limit`.
      A launch-day signup queue would fail this way for almost everyone.
      Fix: configure custom SMTP (Resend) on the Supabase Auth project, which
      needs the verified sending domain below.

- [ ] **BLOCKER — buy and verify a sending domain in Resend.**
      `lib/email/send.ts` still falls back to `Braidr <notifications@braidr.app>`,
      a placeholder that is not verified. Set `RESEND_FROM_EMAIL` once a real
      domain exists. Until then every transactional email (bookings, payouts,
      newsletter, the R-08 Google sign-in notice) depends on a sender that
      cannot deliver.

- [ ] **Registration should not block on the email send.** Even with good SMTP,
      signup currently fails closed with a 502 if delivery is slow, and the
      caller sees nothing useful. Worth making the send asynchronous the way
      `/api/auth/reset-password` already does with `after()`.

## Auth and security

- [ ] **CONTROL — "Confirm email" must stay ON in Supabase Auth.**
      This is the compensating control for an accepted risk (R-08), not a
      preference. With it on, Supabase obfuscates a signup for an address that
      already exists — no error, a fake user id, `identities: []` — so
      registration cannot be used to test whether an address is registered.
      `lib/auth/signup-errors.ts` independently converts an "already
      registered" result into the ordinary success response, so the **response
      body** is safe either way.
      **What the code cannot cover:** with confirmations off, a real signup
      still does strictly more work than a duplicate — an MX lookup, a user
      insert and an email send — so **response time** remains an
      account-existence oracle. That difference is inside Supabase's GoTrue,
      where Braidr cannot reach it. Measured evidence that the paths diverge:
      an existing address short-circuits _before_ address validation, so on a
      domain with no MX an existing address returns 200 where an unknown one
      returns 400.
      **Accepted risk, founder's decision 2026-09-28:** the timing difference
      is not measured and not mitigated. Keeping confirmations on is the
      control. If they are ever turned off, this becomes a live finding again.

- [ ] Rate limiting must be active in production (PRD 8.1 launch gate, P1).
      Upstash is configured and both `auth` (10/15min per IP) and `authEmail`
      (5/hour per address) were confirmed live on 2026-09-28. Note the limiter
      **fails open** on an Upstash outage by design — see R-09.

- [ ] Remaining open audit findings closed or accepted: R-09 (rate-limit gaps),
      R-10, R-11, R-12. See the security audit notes.

## Legal and content

- [ ] Solicitor review of the Terms and Privacy drafts.
- [ ] Footer company-number line.
- [ ] Manual data-export fulfilment process documented (GDPR).

## Accessibility

- [ ] Gold focus ring fails WCAG 1.4.11 contrast — needs a fix or a documented
      exception.

## Testing

- [ ] Playwright in CI.
- [ ] Avatar upload still unimplemented.
