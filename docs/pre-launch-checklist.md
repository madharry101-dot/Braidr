# Braidr pre-launch checklist

Things that must be true before Braidr takes real users. Each item says who
found it and how it was established, so nothing here has to be re-derived.

Items marked **BLOCKER** will break the product for real users on day one.
Items marked **CONTROL** are existing protections that must not be switched
off — they are compensating controls for accepted risks, not nice-to-haves.

---

## Security audit status

**R-01 to R-12 are all closed, fixed and live** as of 2026-09-29. There was
never an R-05 — the original numbering skipped it.

**R-13 is also closed** (2026-09-29), ahead of its gate — it was to be done
before the first paying subscriber, and there are none yet. **No numbered
finding is outstanding.** What remains below is delivery and launch work, not
audit findings.

---

## Email delivery

- [ ] **BLOCKER — move off Supabase's built-in SMTP.**
      Confirmed live on 2026-09-28: auth email sends from
      `noreply@mail.app.supabase.io`, i.e. Supabase's built-in service. That
      service is explicitly not intended for production and allows only a
      handful of messages per hour.
      **This is a capacity blocker, not a current outage.** Registration with
      confirmation demonstrably works: four accounts signed up and clicked
      through on 2026-08-26, 08-28 (x2) and 09-04, and in each case
      `confirmation_sent_at` is only 50-120ms after `created_at` — the handoff
      is fast when there is quota. What fails is any _burst_. Once the hourly
      quota is gone, signup blocks on the send and Netlify kills the function
      at ~10s: a real registration returned **502 after 11.2s**, with no user
      created and no signup request ever reaching Supabase's logs. A retry
      minutes later returned `over_email_send_rate_limit`.
      Four signups in six weeks stayed under the limit. Launch volume will not.
      Fix: custom SMTP (Resend) on the Supabase Auth project, which needs the
      verified sending domain below.

- [ ] **BLOCKER — buy and verify a sending domain in Resend.**
      `lib/email/send.ts` still falls back to `Braidr <notifications@braidr.app>`,
      a placeholder that is not verified. Set `RESEND_FROM_EMAIL` once a real
      domain exists. Until then every transactional email (bookings, payouts,
      newsletter, the R-08 Google sign-in notice) depends on a sender that
      cannot deliver.

- [ ] **CSP alert delivery verified.**
      The daily check in `/api/cron/daily` emails when `csp_violation_reports`
      has new rows (one email per noisy day, throttled on `last_alerted_at`).
      It therefore depends on everything above: a verified sending domain and
      working SMTP. Two things to confirm once those land:
      (a) `CSP_ALERT_EMAIL` is set in Netlify — if it is not, the check runs
      every day, finds violations, and logs "NOBODY IS BEING TOLD" while
      sending nothing;
      (b) an alert actually ARRIVES. Seed one row into
      `csp_violation_reports`, set `cron_alert_state.last_alerted_at` back
      more than 24 hours, run the cron by hand, and confirm the email lands.
      Until that is done, this alerting path has never delivered a message.

- [ ] **Registration should not block on the email send, and needs its own
      timeout.** Even with good SMTP, signup currently fails closed with a 502
      if delivery is slow and the caller sees nothing useful — no error, no
      account, nothing to retry against. Two changes:
      (a) a **route-level timeout** on `POST /api/auth/register` that is
      comfortably under Netlify's function limit, so a slow upstream returns a
      real error envelope instead of a platform 502;
      (b) make the send asynchronous the way `/api/auth/reset-password`
      already does with `after()`.

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

## Moving to the production domain

Doing this changes several things that are currently pinned to
`braidr.netlify.app`. Each one silently breaks a flow if it is missed.

- [ ] **Stripe webhook endpoint and signing secret.** A new endpoint on the new
      domain issues a **new** `STRIPE_WEBHOOK_SECRET`. The old secret keeps
      verifying the old endpoint, so the symptom is webhooks that appear fine
      in Stripe and never arrive — bookings stuck `pending`, payouts never
      released. Update the Netlify env var in the same change, and keep both
      endpoints live until traffic has moved.
- [ ] **`NEXT_PUBLIC_SITE_URL`.** Used to build the password-reset
      `redirectTo`, the Google sign-in notice link, and newsletter links. A
      stale value sends real users to the old host.
- [ ] **Supabase Auth redirect URLs.** Site URL plus the allow-list. A URL that
      is not listed is rejected, so confirmation and reset links stop working.
- [ ] **Google OAuth redirect URIs** in the Google Cloud console, and the
      matching callback in Supabase. Missing entries fail at the consent screen
      with `redirect_uri_mismatch`.
- [ ] **HSTS preload review.** `next.config.mjs` deliberately omits `preload`;
      Netlify currently injects its own HSTS _with_ preload regardless, so this
      is not ours to control on a `netlify.app` subdomain. On Braidr's own
      domain it becomes a real, near-irreversible decision that binds every
      future subdomain to HTTPS. Decide it on purpose.

## Payments

- [x] **R-13 — Stripe object event ordering. CLOSED 2026-09-29 (`4df33e0`).**
      A per-object watermark on `event.created` plus a terminal-cancellation
      rule, both enforced in the database, guard `customer.subscription.*` and
      `account.updated`. Verified against real Postgres: guarded 7/7, the old
      unguarded path 3/7 — it re-enabled a cancelled subscription both from an
      older event and from one sharing the same second.
      Re-run `scripts/verify-stripe-object-ordering.mjs` after any change to
      the webhook handlers or those functions.

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
