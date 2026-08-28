# Braidr v2 — Phase 1 Implementation Plan

**Status:** Phase 1 deliverable — study, compare, report. **No application code has been written or modified.**
**Date:** 2026-08-28
**Author:** Engineering (Claude Code)
**Inputs read in full:** Concept Document v4, PRD v2.0, TRD v2.0, Privacy Policy (draft), Terms of Service (draft), GDPR Consent & Prompts Library.
**Codebase audited:** `C:\Users\harri\braidr` @ commit `a9b8393` (branch `main`), plus the live deploy at `braidr.netlify.app`.

---

## 0. Executive summary

| v2 area                        | Verdict                                                                                                                                                                                          | Size |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| Hosting → Netlify              | **Built and correct.** Migration already done, no Vercel remnants.                                                                                                                               | —    |
| `/login` "only legal text"     | **Not reproducible.** Full form renders on the live site right now. Likely a stale observation or a transient failure during one of the earlier failed deploys. Only real gap: no Google button. | XS   |
| `/braiders` "blank"            | **Not reproducible.** Full search UI renders when authenticated. Logged-out visitors get a spinner then a redirect to `/login`, which can read as "blank".                                       | XS   |
| Google OAuth                   | **Not built.** Zero code.                                                                                                                                                                        | M    |
| BraidCare revised access model | **Mostly correct as-is** after the founder's 2026-08-28 correction (§1.1a): keep the 3-session free cap. Real work: remove the one-off top-up, fix a live "subscribe needs a booking" bug.       | S–M  |
| Referral system                | **Not built.** (All "referral" code in the repo is the unrelated Expert Network feature.)                                                                                                        | M    |
| Settings (per-role)            | **Not built.** `/account` is a read-only stub.                                                                                                                                                   | L    |
| Missing pages/routes           | Several genuinely missing (`/dashboard`, `/settings`, `/pro`, `/income`, `/forgot-password`, `/auth/callback`, `/r/[code]`, `/book/[braiderId]`). `/404` exists.                                 | M    |
| GDPR consent capture           | **Not built.** No `consent_events` table, no cookie banner, no consent checkboxes. Legal pages are placeholders.                                                                                 | L    |

Nothing in the current working feature set (BraidMatch, Braider dashboard, Braidr Pro, Expert Network, Admin, the BraidCare AI pipeline itself) needs to be rebuilt. The v2 work is **additive plus one focused refactor** (BraidCare access gating).

---

## 1. What I found

Organised by the PRD v2.0 changelog areas.

### 1.1 BraidCare access model — _built, but the wrong (v1) model_

The v1 "3 sessions per booking + one-off top-up" model is **fully implemented and load-bearing**:

| Location                                                                 | What it does                                                                                                           | v2 disposition                                                                                                        |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260826000006_bookings.sql:25-27`                  | `sessions_allocated` (default 3), `sessions_used`, `sessions_purchased` columns                                        | **Remove** (destructive migration)                                                                                    |
| `supabase/migrations/20260828000002_braidcare_functions.sql`             | `increment_booking_sessions_used()` / `increment_booking_sessions_purchased()`                                         | **Remove**                                                                                                            |
| `lib/braidcare/eligibility.ts`                                           | `NO_SESSIONS_LEFT` check = `allocated + purchased - used > 0`; already also has a `braidcare_client_subscribed` bypass | **Rewrite** to the 2-path logic (subscription OR confirmed booking within `[braidcare_live_at, appointment_at + 7d]`) |
| `app/api/braidcare/purchase/route.ts`                                    | One Checkout endpoint serving **both** one-off (£9.99) and subscription (£7.99/mo)                                     | **Split**: delete one-off; keep/rename subscription path to `POST /api/braidcare/subscribe` + add `DELETE`            |
| `app/api/stripe/webhook/route.ts:174-181`                                | `handleBraidcareOneoffPurchase()` → `increment_booking_sessions_purchased`                                             | **Remove**                                                                                                            |
| `app/api/braidcare/overview/route.ts:23,59,68-69`                        | selects + computes `sessionsRemaining`                                                                                 | **Rewrite** to eligibility-based                                                                                      |
| `app/(app)/braidcare/page.tsx:63`                                        | UI: "`{used}/{allocated} used`"                                                                                        | **Replace** with the §4.4.2 messaging copy                                                                            |
| `app/api/braidcare/sessions/route.ts:35-38`                              | `sessionNumber = sessions_used + 1`, cap at `sessions_allocated`                                                       | **Rewrite** (session_number can still be a simple counter of that booking's sessions, just not a cap)                 |
| `lib/braidcare/run-analysis.ts:52`                                       | `increment_booking_sessions_used` after a successful report                                                            | **Remove**                                                                                                            |
| `lib/types/braidcare.ts`, `lib/types/braidmatch.ts`, `types/database.ts` | typed `sessions_*` fields                                                                                              | **Update**                                                                                                            |

**Subscription mechanism — partially built.** There is no `braidcare_subscriptions` table (the migration file _named_ `20260828000001_braidcare_subscriptions.sql` actually just adds two columns to `profiles`). What exists:

- `profiles.stripe_customer_id`, `profiles.braidcare_client_subscribed` (booleans, webhook-managed, self-update-guarded by a trigger).
- `/api/braidcare/purchase` with `type: "subscription"` → Stripe subscription Checkout → webhook `customer.subscription.created` (`subscription_type: braidcare_client`) flips the boolean; `customer.subscription.deleted` clears it.

This works, but it has no `status` / `current_period_end` / `price_pence`, which the Settings billing view (§4.10.1 "BraidCare subscription status and management") will need. **See open question Q2.**

**`braidcare_live_at` generated column** — present and correct (`appointment_at - INTERVAL '24 hours'` via `public.minus_24_hours`), recalculates on reschedule. **Keep unchanged**, as v2 instructs.

**Photo retention** — GDPR-04 and Privacy Policy §7 both state scalp photos are **auto-deleted 90 days after upload**. I found **no scheduled job** that does this (the three `netlify/functions/cron-*.mjs` are payouts, BraidCare-analysis retry, HMRC reminders). This is a compliance gap regardless of the access-model change. **See open question Q4.**

**Braider-side** BraidCare Professional (£14.99/mo, `braider_profiles.braidcare_subscribed` + `braidcare_badge_active`) — unchanged in v2, and correctly unchanged in the code. **Leave alone.**

### 1.1a BraidCare access model — FOUNDER CORRECTION (2026-08-28)

> The free/subscription split was mis-specified in PRD v2.0 / TRD v2.0 / Concept v4. The corrected model, per the founder, is:
>
> - **Free tier:** 3 sessions per confirmed paid booking, unlocking 24h before the appointment. **This is the original v1 model — the session cap stays.**
> - **Subscription (£7.99/mo):** unlimited sessions, subscribe any time, **no booking required, no gate of any kind**.
> - **Live bug to fix:** the BraidCare page blocks Subscribe with "You need at least one confirmed booking to subscribe." — remove entirely; subscribing must work with zero bookings.

This **substantially shrinks** the BraidCare work. The v2 docs' "remove all session counting" instruction is **superseded** — we keep `sessions_allocated` / `sessions_used` and the cap. What actually changes:

| Item                                                                                                 | Revised disposition                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookings.sessions_allocated` (default 3), `bookings.sessions_used`                                  | **KEEP** — the free-tier cap                                                                                                                                                             |
| `bookings.sessions_purchased`                                                                        | **DROP** — only ever fed by the one-off top-up, which v2 removes; always `0` in every row, so the drop is trivial and safe (this is all "Q1" is now)                                     |
| `increment_booking_sessions_used()`                                                                  | **KEEP**                                                                                                                                                                                 |
| `increment_booking_sessions_purchased()`                                                             | **DROP**                                                                                                                                                                                 |
| `lib/braidcare/run-analysis.ts:52` (`increment_booking_sessions_used` after a report)                | **KEEP**                                                                                                                                                                                 |
| `app/api/braidcare/purchase` — one-off (£9.99) branch                                                | **DELETE**                                                                                                                                                                               |
| `app/api/braidcare/purchase` — subscription branch                                                   | **KEEP**, move to `POST /api/braidcare/subscribe`; **stop requiring `booking_id`** (currently it looks a booking up for _both_ paths — `purchase/route.ts:26-32` — and 404s without one) |
| `app/api/stripe/webhook/route.ts` — `handleBraidcareOneoffPurchase()`                                | **DELETE**                                                                                                                                                                               |
| `app/(app)/braidcare/page.tsx:110-114` — `firstBooking` guard on `subscribe()`                       | **DELETE** (this is the live bug)                                                                                                                                                        |
| `lib/validations/braidcare.ts` — `purchaseSchema` requiring `booking_id`                             | **SPLIT** — a `subscribeSchema` with no `booking_id`                                                                                                                                     |
| `app/api/braidcare/overview/route.ts:59` — `sessions_allocated + sessions_purchased - sessions_used` | → `sessions_allocated - sessions_used`                                                                                                                                                   |
| `app/(app)/braidcare/page.tsx:63` — "`{used}/{allocated} used`"                                      | **KEEP** for free-tier users; hide/replace for subscribers ("Unlimited")                                                                                                                 |
| `lib/braidcare/eligibility.ts`                                                                       | **Rewrite to the two-path check below** (not the single unlimited path the first draft of this plan assumed)                                                                             |

**Confirmed eligibility logic** (per session-start attempt; inputs: `user`, optional `booking_id`):

```
1. user has an active BraidCare subscription (status = 'active')?
     → ELIGIBLE   reason = 'subscription'          (unlimited; no window, no cap)

2. else, booking_id supplied?
     a. booking belongs to user?            no → BOOKING_NOT_FOUND
     b. booking.status === 'confirmed'?     no → BOOKING_NOT_CONFIRMED
     c. now >= booking.braidcare_live_at?   no → WINDOW_NOT_OPEN
     d. booking.sessions_used < booking.sessions_allocated (3)?
                                            no → NO_SESSIONS_LEFT
     → ELIGIBLE   reason = 'free_booking_window'    (capped at 3)

3. else
     → NOT ELIGIBLE   reason = 'NO_BOOKING_OR_SUBSCRIPTION'
```

This is the current `lib/braidcare/eligibility.ts` logic **minus** the `sessions_purchased` term in check (d), **plus** the subscription check promoted to path 1 as a full bypass (it already exists there as a partial bypass), **plus** `/api/braidcare/subscribe` no longer needing a booking.

**One point still open — window upper bound (Q4a):** current v1 code has _no_ upper time bound (once the 24h window opens it never closes; the 3-session cap is the only limit). The v2 docs added `appointment_at + 7 days` "for pre-removal checks". The founder's correction says "the original v1 model" and only mentions the 24-hour unlock, not a close. **Proposed: keep v1 behaviour — no upper bound.** Confirm, or say you want the +7-day tail.

### 1.2 Authentication — Google OAuth — _not built_

Zero traces (`signInWithOAuth`, `/auth/callback`, `complete-oauth`, `link-google` — all absent).

| Requirement                                                              | State                         |
| ------------------------------------------------------------------------ | ----------------------------- |
| "Continue with Google" on `/login` and `/register` above the form        | **Not built**                 |
| `/auth/callback` route handler                                           | **Not built** (404 on live)   |
| `/auth/complete-registration` page (role + consent for new OAuth users)  | **Not built**                 |
| `POST /api/auth/complete-oauth-registration`                             | **Not built**                 |
| `POST /api/auth/link-google`, `DELETE /api/auth/unlink-google`           | **Not built**                 |
| Google-only account detection in the forgot-password flow (FR-AUTH-02.6) | **Not built**                 |
| Supabase Dashboard → Providers → Google config                           | **Founder action** (not code) |

Existing email/password auth (`/api/auth/{login,register,logout,session,verify-email,reset-password}`, `middleware.ts` role gating) is solid and **stays as the base**. Email verification **is already implemented** (`register` returns `email_confirmation_required`; `/verify-email` page + `/api/auth/verify-email` exist) — the founder's guess was right; no work needed there.

### 1.3 Referral system — _not built_

No `profiles.referral_code` / `referred_by`. No `/r/[code]` (404 on live). No `/api/referrals/me`. `handle_new_user()` inserts only `id, role, full_name`.

Everything the repo grep returns for "referral" is the **Expert Network** referral feature (`expert_referrals` table, `referral_suggested` flags, dermatologist hand-offs) — a completely separate concept. **Do not conflate the two.**

### 1.4 Settings — _stub only_

`/account` (`app/(app)/account/page.tsx`) is **read-only**: it prints name / email / role / city and nothing else. No `/settings` route (404 on live). No `/api/settings/*` endpoints. No notification-preferences storage anywhere. Nav has an "Account" link, no "Settings".

Per-role settings from PRD §4.10 (Client / Braider / Expert / Admin) are **entirely unbuilt**, though many of the _underlying_ controls exist scattered across the braider dashboard (profile, services, availability, payments) and could be linked or surfaced from a Settings shell.

### 1.5 Missing pages / route inventory (PRD §4.11)

Verified against the live site:

| Route (PRD v2)                                                                                                                         | Live status                    | Note                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `/` `/register` `/login` `/verify-email` `/terms` `/privacy` `/braiders` `/braiders/[id]` `/bookings` `/braidcare` `/experts` `/admin` | **exist**                      | `/login` + `/braiders` render correctly (see §1.6); `/terms` + `/privacy` are placeholders                                      |
| `/404`                                                                                                                                 | **exists**                     | `app/not-found.tsx`                                                                                                             |
| `/dashboard` (role-aware)                                                                                                              | **404**                        | only `/dashboard/{client,braider,expert}` exist; no bare router page; middleware doesn't handle it                              |
| `/settings`                                                                                                                            | **404**                        | see §1.4                                                                                                                        |
| `/forgot-password`                                                                                                                     | **404**                        | equivalent exists as `/reset-password` (+ `/reset-password/confirm`) — naming mismatch                                          |
| `/reset-password`                                                                                                                      | exists (as the _request_ form) | PRD wants this to be the _set-new-password_ page; current split is request=`/reset-password`, confirm=`/reset-password/confirm` |
| `/auth/callback`                                                                                                                       | **404**                        | OAuth — §1.2                                                                                                                    |
| `/r/[code]`                                                                                                                            | **404**                        | referral — §1.3                                                                                                                 |
| `/pro`                                                                                                                                 | **404**                        | exists nested as `/dashboard/braider/pro`                                                                                       |
| `/income`                                                                                                                              | **404**                        | exists nested as `/dashboard/braider/pro/income`                                                                                |
| `/book/[braiderId]`                                                                                                                    | **404**                        | exists nested as `/braiders/[id]/book`                                                                                          |

The nested routes **work** — this is a URL-shape mismatch, not missing functionality. **See open question Q6.**

### 1.6 The two "confirmed broken" pages

**`/login`** — I read the live accessibility tree: it renders `heading "Sign in"`, an email textbox, a password textbox, a "Forgot password?" link, and a "Sign in" submit button. The form is present and works (the founder logged in successfully via it earlier today). The `(auth)` layout renders a small legal footer — "By continuing you agree to Braidr's Terms and Privacy Policy" — beneath the card. **My hypothesis:** the founder saw a moment when the client component failed to hydrate (its `<Suspense fallback>` is `null`), leaving only the logo + that legal footer visible — matching "only legal text". This lines up with the several failed Netlify deploys on 2026-08-27. **Current state: working.** Gap vs v2: no Google button.

**`/braiders`** — renders a full filter bar (location / style / budget / verified / BraidCare), a photo style-match panel, a results grid, and an empty state, **when authenticated**. `AppShell` shows a spinner then client-redirects unauthenticated users to `/login`. A logged-out founder visiting `/braiders` would see spinner → bounce, which can read as "blank". **Current state: working when authed.** (Confirmed end-to-end against live Supabase in the 2026-08-27 build sessions.)

> I could **not** reproduce either reported fault. If the founder can still reproduce one, I need: which page, logged in or out, which browser, and any console errors. See risk R7.

### 1.7 Hosting / Netlify (TRD v2 §7)

**Done and correct.**

- `netlify.toml` present (`next build`, `@netlify/plugin-nextjs`, esbuild function bundler).
- **No Vercel remnants** anywhere (`vercel.json` deleted; no `VERCEL_*` refs; no Vercel imports).
- Three scheduled functions registered and verified live (`cron-release-payouts`, `cron-retry-braidcare-analysis`, `cron-hmrc-deadline-reminders`).
- Middleware runs as a Netlify Edge Function automatically.
- Minor: `@netlify/plugin-nextjs` is not pinned in `package.json` (Netlify auto-installs it from the `[[plugins]]` block). Cheap to add for reproducibility.
- Deviation from TRD §6.3: rate limiting is implemented **in-app** (`lib/api/rate-limit.ts`, Upstash, just hardened and verified enforcing) rather than as a Netlify Edge Function. The TRD's edge-function snippet is marked "illustrative — adapt to chosen provider". **Recommend keeping the in-app implementation** — it works, it's provider-agnostic, and moving auth checks to the edge adds latency and complexity for no real gain here. Flag for founder acknowledgement only. See Q7.
- Open decision carried over from TRD: **Netlify Analytics vs Plausible.** Neither is wired. See Q5.

### 1.8 GDPR consent (PRD §4.12, TRD §3.5 / §6.4, Consent Library)

**Nothing is built.**

- No `consent_events` table.
- No cookie banner (GDPR-03).
- No Terms/Privacy consent checkbox on `/register` (GDPR-01) — the button is not gated; consent is implied by the layout footer text only, which is **not GDPR-adequate**.
- No marketing opt-in (GDPR-02).
- No BraidCare first-use consent screen (GDPR-04) — **the highest-risk gap**; scalp photos are special-category data and there is currently no explicit, unbundled, opt-in gate before the first upload.
- No consent-withdrawal UI (GDPR-05), data-export (GDPR-07), or account-deletion workflow (GDPR-08).
- `/terms` and `/privacy` are ~13-line placeholders; full drafted content exists but is unpublished and "not solicitor-reviewed".
- Partial adjacency: `expert_referrals.consent_given` already records the expert-referral data-share decision (GDPR-06) — it should _also_ write a `consent_events` row for a single source of truth.

---

## 2. What I understand needs to happen (the delta, once "already built" is excluded)

1. **Google OAuth, end to end** — button on both auth pages; `/auth/callback`; a new-OAuth-user completion page capturing role + Terms/Privacy consent; link/unlink endpoints; Google-only detection in forgot-password. (Founder does the Supabase provider config.)
2. **BraidCare access — fix + trim** _(scope reduced per §1.1a — keep the 3-session free cap)_ —
   a. Subscription storage with `status` + `current_period_end` (table vs columns — Q2).
   b. Rewrite `eligibility.ts` to the confirmed two-path check in §1.1a (subscription → unlimited; OR confirmed booking in window → capped at 3). Window upper bound per Q4a.
   c. `GET /api/braidcare/eligibility`; `POST`/`DELETE /api/braidcare/subscribe` — **no `booking_id` requirement on subscribe**.
   d. **Fix the live bug:** delete the "subscribe needs a booking" guard (`braidcare/page.tsx:110-114`) and the matching `booking_id` lookup in the API.
   e. Delete the one-off top-up (endpoint branch, `handleBraidcareOneoffPurchase`, `purchaseSchema`, UI).
   f. Migration dropping **only** `bookings.sessions_purchased` + `increment_booking_sessions_purchased()`.
   g. Update `overview` (drop the `sessions_purchased` term), UI copy for the corrected model, and types.
3. **90-day scalp-photo deletion job** — a scheduled function that hard-deletes storage objects + rows past 90 days (compliance gap independent of everything else) (Q4).
4. **Referral system (Phase 1, link-only)** — `profiles.referral_code` (unique, DB default) + `referred_by` FK; capture `referred_by` from the 30-day cookie at registration (email/password **and** OAuth paths); `/r/[code]` handler with braider-profile redirect; `GET /api/referrals/me`; Dashboard card + Settings → Referrals ("Rewards coming soon" only — no rewards tables).
5. **Settings, per role** — a `/settings` shell with role-specific section navigation; `GET/PUT /api/settings/profile`, `GET/PUT /api/settings/notifications`, `GET /api/settings/payment-methods`, `GET /api/settings/billing-history`, `GET /api/settings/privacy/export`, `POST /api/settings/consent`, `DELETE /api/settings/account`; a `notification_preferences` store (jsonb column or small table); wire the existing braider profile/services/availability/payments controls in where the spec expects them; add a "Settings" nav entry; fold `/account` in.
6. **GDPR consent capture** — `consent_events` table (append-only, RLS per TRD §3.5); cookie banner (GDPR-03) → `POST /api/settings/consent`; register-form Terms/Privacy checkbox (GDPR-01, gates submit) + marketing opt-in (GDPR-02); BraidCare first-use consent screen (GDPR-04) before the first upload, re-shown after any withdrawal; withdrawal flow (GDPR-05); expert-referral-share also logs a `consent_events` row (GDPR-06); data-export request (GDPR-07); 30-day account-deletion workflow with immediate anonymisation (GDPR-08); OAuth completion consent (GDPR-09). Use the Consent Library copy **verbatim**.
7. **Legal pages** — publish the drafted Privacy Policy + Terms content, with a visible "draft — pending legal review" banner if the founder wants it live pre-review (Q3); add a footer "Cookie preferences" link.
8. **Route reconciliation** — add `/dashboard` (role-aware redirect/router); decide the canonical URL shape for `/pro`, `/income`, `/book/[braiderId]`, `/forgot-password` and add redirects or move the routes (Q6).
9. **Minor** — pin `@netlify/plugin-nextjs` in `package.json`.

---

## 3. Proposed implementation plan

### Proposed sequencing (differs slightly from PRD §4.11's "prioritise order" — rationale below)

The PRD says to fix `/login` and `/braiders` first because they "block every other user journey". **They are not actually broken** (§1.6), so that priority is moot. I propose leading with the consent foundation + OAuth instead, because the OAuth registration flow itself requires the GDPR-09 consent capture, so building consent plumbing first avoids rework.

| Batch                                                                    | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Touches production data?                                                                      | Depends on                                                 |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **B0 — Groundwork**                                                      | `consent_events` table + RLS migration; `POST /api/settings/consent`; pin `@netlify/plugin-nextjs`; add `/dashboard` role-aware router page; confirm `/login` + `/braiders` render (close out the "broken" reports with evidence, or gather repro info)                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | New table only (no backfill)                                                                  | —                                                          |
| **B1 — Auth & OAuth**                                                    | "Continue with Google" on `/login` + `/register`; `/auth/callback`; `/auth/complete-registration` page + `POST /api/auth/complete-oauth-registration` (role + GDPR-09 consent); `POST /api/auth/link-google` + `DELETE /api/auth/unlink-google`; forgot-password → detect Google-only accounts (FR-AUTH-02.6); rename/alias `/reset-password` request page to `/forgot-password`; register-form Terms/Privacy checkbox (GDPR-01) + marketing opt-in (GDPR-02) writing `consent_events`                                                                                                                                                                                                                                      | Adds `consent_events` rows                                                                    | B0; **founder: Supabase Google provider config**           |
| **B2 — Cookie banner + legal**                                           | Cookie banner (GDPR-03) → `consent_events`; footer "Cookie preferences"; publish Privacy Policy + ToS content with a "Draft — pending legal review" banner; enable **Netlify Analytics** (dashboard toggle — no code/script; the banner still gates any future client-side analytics)                                                                                                                                                                                                                                                                                                                                                                                                                                       | Adds `consent_events` rows                                                                    | B0                                                         |
| **B3 — BraidCare: fix subscribe + remove one-off** _(revised per §1.1a)_ | Build `braidcare_subscriptions` table (Q2); rewrite `eligibility.ts` to the confirmed two-path logic in §1.1a (keep the 3-session cap, no window upper bound); `GET /api/braidcare/eligibility`; move subscription path to `POST`/`DELETE /api/braidcare/subscribe` **with no `booking_id` requirement**; **delete the "subscribe needs a booking" guard** (`braidcare/page.tsx:110-114`) + the API's `booking_id` lookup; delete the one-off top-up (endpoint branch + `handleBraidcareOneoffPurchase` + `purchaseSchema`); update `overview` (drop `sessions_purchased` term); UI copy for the corrected model; update types; migration dropping `bookings.sessions_purchased` + `increment_booking_sessions_purchased()` | Adds `braidcare_subscriptions` (webhook-populated, no backfill); drops one always-zero column | —                                                          |
| **B4 — BraidCare photo retention**                                       | New scheduled function `cron-purge-braidcare-photos.mjs`: hard-delete scalp-photo storage objects + photo rows > 90 days old; keep the text report; log counts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Deletes real data on schedule (that's the point)                                              | —                                                          |
| **B5 — Referral system**                                                 | `profiles.referral_code` (unique, DB default) + `referred_by` FK migration; capture `referred_by` from cookie in both registration paths; `/r/[code]` handler (cookie + redirect, braider → `/braiders/[id]`); `GET /api/referrals/me`; Dashboard referral card; Settings → Referrals section                                                                                                                                                                                                                                                                                                                                                                                                                               | Adds two nullable columns; `referral_code` backfilled for existing rows via the default       | B0 (ideally B1, so OAuth path also captures `referred_by`) |
| **B6 — Settings**                                                        | `/settings` shell + per-role section nav; `GET/PUT /api/settings/profile`; `GET/PUT /api/settings/notifications` + `notification_preferences` store; `GET /api/settings/payment-methods`; `GET /api/settings/billing-history`; wire in existing braider controls; "Settings" nav entry; fold in `/account`; BraidCare subscription management UI (uses B3)                                                                                                                                                                                                                                                                                                                                                                  | New `notification_preferences` column/table                                                   | B1, B3, B5                                                 |
| **B7 — GDPR flows**                                                      | BraidCare first-use consent (GDPR-04) before first upload + re-prompt after withdrawal; withdrawal flow in Settings (GDPR-05); expert-referral-share also logs `consent_events` (GDPR-06); data-export request (GDPR-07) — request log + 48h email; account deletion (GDPR-08) — 30-day soft-delete + immediate anonymise + payout-clear guard for braiders                                                                                                                                                                                                                                                                                                                                                                 | Adds rows; account-deletion path anonymises/deletes on request                                | B0, B6                                                     |
| **B8 — Route cleanup**                                                   | Redirects `/pro`→`/dashboard/braider/pro`, `/income`→`/dashboard/braider/pro/income`, `/book/[braiderId]`→`/braiders/[id]/book`; real `/dashboard`; `/reset-password` request page → `/forgot-password`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | None                                                                                          | —                                                          |

Each batch ends with: `typecheck` + `lint` + `jest` green, new Jest/Playwright coverage for the batch, and a live check on the Netlify deploy preview before merge.

### Notable file-level work

- **New migrations** (additive): `consent_events`; `braidcare_subscriptions` (Q2 = table); `profiles.referral_code` + `referred_by`; `notification_preferences`.
- **One small drop migration**: `bookings.sessions_purchased` + `increment_booking_sessions_purchased()` (column is `0` everywhere — safe). `sessions_allocated` / `sessions_used` / `increment_booking_sessions_used()` are **kept**.
- **New routes:** `app/auth/callback/route.ts`, `app/(auth)/auth/complete-registration/page.tsx`, `app/r/[code]/route.ts`, `app/(app)/dashboard/page.tsx`, `app/(app)/settings/**`, `app/(auth)/forgot-password/page.tsx`.
- **New API:** `app/api/auth/{complete-oauth-registration,link-google,unlink-google}/route.ts`, `app/api/braidcare/{eligibility,subscribe}/route.ts`, `app/api/referrals/me/route.ts`, `app/api/settings/**`, `app/api/dashboard/route.ts`.
- **Rewrites:** `lib/braidcare/eligibility.ts`, `app/api/braidcare/overview/route.ts`, `app/api/braidcare/sessions/route.ts`, `app/(app)/braidcare/page.tsx`, `app/api/stripe/webhook/route.ts` (remove one-off branch), `app/(auth)/register/page.tsx` + `app/api/auth/register/route.ts` (consent + referred_by), `components/nav/nav-items.ts`, `supabase/migrations/…handle_new_user` (referred_by pass-through).
- **New components:** `CookieBanner`, `ContinueWithGoogleButton`, `ConsentCheckbox`, `BraidCareConsentScreen`, `ReferralCard`, `SettingsShell` + section components.
- **New scheduled function:** `netlify/functions/cron-purge-braidcare-photos.mjs`.
- **Legal content:** `app/(legal)/{terms,privacy}/page.tsx`.

---

## 4. Risks and open questions

### Founder decisions — ALL RESOLVED (2026-08-28)

- **Q1 — Column drop.** ✅ Proceed. Drop `bookings.sessions_purchased` (always `0`). Keep `sessions_allocated` + `sessions_used`.
- **Q4a — Free-tier window upper bound.** ✅ Keep v1 behaviour — **no upper bound**; the 3-session cap is the only limit. Do not add the `appointment_at + 7d` tail.
- **Q2 — BraidCare subscription storage.** ✅ **Build the `braidcare_subscriptions` table** per TRD v2 §3.3 (`user_id`, `role`, `stripe_subscription_id`, `status`, `price_pence`, `current_period_end`). Webhook-populated; the existing `profiles.braidcare_client_subscribed` boolean becomes a derived convenience (keep it in sync, or replace reads with a join — decide during B3).
- **Q3 — Legal drafts.** ✅ Publish the Privacy Policy + ToS content now, with a visible **"Draft — pending legal review"** banner.
- **Q4 — Photo purge.** ✅ **90-day hard-delete of the image** (storage object + photo row). **Keep the text report** (persists until account deletion).
- **Q5 — Analytics.** ✅ **Netlify Analytics** (server-side, no client script, no cookie-consent interaction needed for it). The cookie banner's "analytics" category still gates any future client-side script.
- **Q6 — Route shapes.** ✅ Add `/pro`, `/income`, `/book/[braiderId]` as **redirects** to the existing nested routes; add a real role-aware **`/dashboard`**; **rename `/reset-password` → `/forgot-password`** (the request form), keeping `/reset-password` (or `/reset-password/confirm`) as the set-new-password page per PRD §4.11.
- **Q7 — Rate limiting.** ✅ Stays **in-app** (`lib/api/rate-limit.ts`). Documented deviation from TRD §6.3's edge-function suggestion.

### Technical risks

- **R1 — Supabase Google account-merge behaviour** (TRD §6.1 "test this specifically"). If a user registered with `x@gmail.com` via password then signs in with Google on the same address, Supabase may or may not link cleanly depending on the "Confirm email" / identity-linking project settings. **Mitigation:** test explicitly on a deploy preview against the live Supabase project before shipping B1; document the actual behaviour.
- **R2 — `referral_code` uniqueness.** TRD's suggested default `upper(substr(md5(random()::text),1,8))` is 8 hex chars = collision-safe at this scale but the column is `UNIQUE NOT NULL`, so a collision = a failed signup. **Mitigation:** generate in the app with a retry loop, or use a longer/nanoid code. Low probability, easy to handle.
- **R3 — Consent-gating registration is a conversion risk if buggy.** A broken "I agree" checkbox = nobody can register. **Mitigation:** thorough tests on B1; ship behind the deploy preview first.
- **R4 — BraidCare eligibility change touches a tested code path.** `lib/braidcare/eligibility.ts` has an existing Jest suite tied to the v1 error-code table (`BOOKING_NOT_FOUND` / `BOOKING_NOT_CONFIRMED` / `WINDOW_NOT_OPEN` / `NO_SESSIONS_LEFT`). After the §1.1a correction the change is small — those codes all survive; only the `sessions_purchased` term drops and the subscription bypass is promoted to a full path-1 short-circuit — so most existing tests stay valid. **Mitigation:** update the suite alongside, add cases for "subscriber with zero bookings → eligible" and "subscribe endpoint with no booking_id → 200".
- **R5 — `/login` / `/braiders` "broken" reports unresolved.** I can't fix what I can't reproduce. If it was a transient deploy failure it's already gone; if it's an intermittent hydration bug it will resurface. **Mitigation:** add a Playwright test that asserts the `/login` form fields and the `/braiders` filter bar are actually visible post-hydration on the deploy preview, so any regression is caught in CI.
- **R6 — Account-deletion workflow (GDPR-08) interacts with financial retention.** Must anonymise immediately but retain `income_records` / booking payment rows for 7 years (HMRC), and must not delete a braider with an unsettled payout. **Mitigation:** soft-delete + field-level anonymisation, explicit retention allow-list, payout-clear guard — matches the existing admin "remove → delete-or-anonymise" logic, which I can extend rather than reinvent.
- **R7 — Scope creep in Settings.** §4.10 lists a lot. Some (notification toggles, data export, consent) are genuinely new; others (braider profile/services/availability/payments) already exist and just need surfacing. **Mitigation:** B6 builds the shell + genuinely-new sections and _links_ to existing screens rather than duplicating them; anything ambiguous comes back to you before building.

### Documentation conflicts found (flagging per the handover note)

- **C1 — Photo retention number.** Consistent at 90 days across GDPR-04 and Privacy §7 — no conflict, but it's a promise with no implementing code today (R/Q4).
- **C2 — `/reset-password` semantics.** ✅ Resolved via Q6 — rename the request page to `/forgot-password`.
- **C3 — `braidcare_subscriptions`.** ✅ Resolved via Q2 — build the table; the existing similarly-named migration only added `profiles` columns.
- **C5 — BraidCare access model itself.** PRD v2 §4.4, TRD v2 §3.2/§3.3.1, and Concept v4 §"BraidCare Rules" all specify "remove session counting entirely / free access has no session limit". The founder's 2026-08-28 chat correction **overrides all three**: the 3-session free cap stays; only the one-off top-up is removed. §1.1a is the governing spec for this feature. The three documents should be corrected to match.
- **C4 — Rate limiting location.** TRD v2 §6.3 implies Netlify Edge Function; build has it in-app (Q7).

---

## 5. What I will NOT touch

Confirmed working and **out of scope** for v2 unless a batch above explicitly names the file:

- **BraidMatch** — braider search, filters, style-match panel, braider public profile, the booking flow, Stripe Connect Express onboarding, destination charges, the 24h payout-release cron, cancellation/refund/reschedule/dispute logic.
- **Braider dashboard** — profile editor, services CRUD, availability grid + blocked dates, Stripe Connect status page, booking pipeline. (Settings will _link_ to these, not modify them.)
- **Braidr Pro** — the 5-step pathway, £35/mo subscription + trial, UTR encryption + masking, badge award on step 4, income records, invoice PDFs, CSV export, HMRC deadline reminder cron. (Commission stays 12% / 5%.)
- **Expert Network** — expert directory, profile setup + credential upload, admin verification queue, referral inbox, the `braidcare_sessions_select_consented_expert` RLS policy. (B7 only _adds_ a `consent_events` write alongside the existing `expert_referrals.consent_given`.)
- **Admin panel** — verification, disputes (dismiss/refund + Stripe reversal), user suspend/remove, announcements, moderation log, platform report. (B0's `consent_events` gets an admin read policy; nothing else changes.)
- **BraidCare AI pipeline** — the Claude Sonnet vision call, tool-use structured output, the no-diagnosis language rules, `PhotoCapture` / `BraidcareReport` / disclaimer components, the retry cron. Only the _access gating_ around it changes (B3), not the analysis.
- **Scalp image storage security** — private bucket, 1-hour signed URLs, EXIF stripping. (B4 _adds_ a purge job; it doesn't change how photos are stored or served.)
- **Core auth** — `/api/auth/{login,logout,session,verify-email}`, session cookies, `middleware.ts` role gating, the suspension checks. Email/password + email verification stay exactly as they are; OAuth is added alongside.
- **Design system** — tokens in `globals.css` / `tailwind.config.ts`, `components/ui/*`, `AppShell`, the responsive nav. (New components follow the existing patterns; "Settings" gets a nav slot.)
- **Hosting** — `netlify.toml`, the three existing scheduled functions, the Vercel→Netlify migration. (Only additions: pin the plugin, add the photo-purge function.)
- **The rate-limit hardening** shipped today (`lib/api/rate-limit.ts`, `clientIp()`, `scripts/flush-ratelimit.mjs`).
- **All 29 existing migrations.** v2 adds new migrations only; the one drop migration (B3, `sessions_purchased`) is on an always-empty column.

---

## 6. Status & immediate next step

**All founder decisions Q1–Q7 (+ Q4a) resolved 2026-08-28. Eligibility logic in §1.1a confirmed by the founder.**

Outstanding founder action (not a blocker for B0): **enable Google in Supabase → Authentication → Providers** (needs a Google Cloud OAuth client ID + secret) before B1 ships.

On approval of this plan I start with **B0** (consent_events table + `/api/settings/consent`, `@netlify/plugin-nextjs` pin, `/dashboard` router, and a Playwright test that pins the `/login` form + `/braiders` filter bar so the "broken" reports can't silently regress), then work down B1 → B8.

**Awaiting a single "go" on the plan and sequencing before writing Phase 2 code.**
