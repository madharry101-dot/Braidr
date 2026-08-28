import { LegalDoc, Section, Sub, KeyList, Callout } from "@/components/legal/legal-doc";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated="August 2026">
      <Section n="1" title="Who We Are">
        <p>
          Braidr Ltd (&ldquo;Braidr&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
          is the data controller for personal data processed through the Braidr platform, accessible
          at braidr.netlify.app and any successor domain (the &ldquo;Platform&rdquo;). Braidr
          operates a marketplace connecting clients seeking hair braiding services with independent
          braiding professionals, alongside a wellness monitoring tool (&ldquo;BraidCare&rdquo;) and
          a self-employment support pathway (&ldquo;Braidr Pro&rdquo;).
        </p>
        <p>
          This policy explains what personal data we collect, why we collect it, how long we keep
          it, who we share it with, and the rights you have over it. It applies to clients,
          braiders, clinical experts, and visitors to the Platform. For data protection queries,
          contact privacy@braidr.app (a formal Data Protection contact will be confirmed before
          public launch).
        </p>
      </Section>

      <Section n="2" title="What Data We Collect">
        <Sub title="2.1 Data you give us directly">
          <KeyList
            items={[
              [
                "Account information",
                "Full name, display name, email, password (hashed), phone number, profile photo.",
              ],
              [
                "Location data",
                "City and area/neighbourhood — not a braider's precise address; public profiles show a general area only.",
              ],
              [
                "Braider profile data",
                "Bio, specialisations, years of experience, portfolio photos, service menu, pricing.",
              ],
              [
                "Expert profile data",
                "Credentials, clinic name, specialisation, professional registration details, credential documents.",
              ],
              [
                "Booking data",
                "Appointment date and time, service selected, amount paid, cancellation history.",
              ],
              [
                "Payment data",
                "Processed entirely by Stripe. We do not store full card numbers — only Stripe customer/account references, transaction amounts, and payout records.",
              ],
              [
                "Scalp photographs",
                "Images submitted for BraidCare analysis (explicit consent required — see Section 4).",
              ],
              [
                "Health-adjacent data",
                "AI-generated observations about scalp condition, aftercare recommendations, referral flags.",
              ],
              [
                "Tax and business data",
                "UTR, income records, insurance documents (braiders using Braidr Pro).",
              ],
              ["Communications", "Messages to support, dispute correspondence, reviews."],
            ]}
          />
        </Sub>
        <Sub title="2.2 Data we collect automatically">
          <p>
            Device and usage data (IP address, browser and device type, pages visited, session
            duration, referral source); cookies and similar technologies (see Section 9); and
            server/security logs recording API requests, errors, and security events.
          </p>
        </Sub>
        <Sub title="2.3 Data we receive from third parties">
          <p>
            From Google, if you use &ldquo;Continue with Google&rdquo;: your name, email address,
            and profile photo, as authorised by you. From Stripe: payment, payout, and Connect
            verification status. From Anthropic (Claude API): no data beyond the processed response
            to a request we send.
          </p>
        </Sub>
      </Section>

      <Section n="3" title="Why We Process Your Data (Legal Basis)">
        <KeyList
          items={[
            [
              "Contract",
              "Creating and managing your account; processing bookings, payments, confirmations and reminders; delivering Braidr Pro guidance.",
            ],
            [
              "Explicit consent (Art. 9)",
              "BraidCare photograph analysis — scalp photographs are treated as special category data. We never rely on contract or legitimate interest for this; you may withdraw consent at any time (Section 4).",
            ],
            [
              "Consent",
              "Marketing emails (only if you opt in) and analytics cookies (only if you accept them via the cookie banner).",
            ],
            [
              "Legitimate interest",
              "Fraud prevention and platform security; referral attribution (anonymous until you register).",
            ],
            ["Legal obligation", "Responding to lawful requests from UK courts or regulators."],
          ]}
        />
      </Section>

      <Section n="4" title="BraidCare — Special Category Data">
        <Callout>
          Scalp photographs are the most sensitive category of data Braidr processes. This section
          governs them specifically and takes precedence over any general statement elsewhere in
          this policy.
        </Callout>
        <Sub title="4.1 Consent required before any photograph is processed">
          <p>
            Before you submit your first BraidCare photograph you will be shown an explicit consent
            screen that you must actively accept. This consent is separate from your acceptance of
            this Privacy Policy and the Terms of Service, and is never bundled or implied.
          </p>
        </Sub>
        <Sub title="4.2 How BraidCare photographs are handled">
          <p>
            Photographs are uploaded to private storage, are never publicly accessible, and never
            appear on your public profile. They are sent to our AI processing partner (Anthropic)
            solely to generate your wellness report — not to train any model, and not retained by
            that partner beyond the time needed to generate your report. EXIF metadata (which can
            include GPS location) is stripped from every photograph before storage.
          </p>
          <p>
            The generated report (text observations and recommendations) is stored against your
            account. The underlying photographs are stored separately and are{" "}
            <strong>deleted automatically 90 days after upload</strong>, unless you delete them
            sooner. Your braider can see the wellness flags from your sessions (e.g. &ldquo;mild
            tension observed&rdquo;) only if you have an active booking with them, and only in
            summary form — never your photographs.
          </p>
        </Sub>
        <Sub title="4.3 BraidCare is not medical advice">
          <Callout>
            BraidCare is a wellness monitoring tool. It does not diagnose any medical condition and
            is not a substitute for professional medical advice. If you have a health concern about
            your scalp or hair, please consult a GP, dermatologist, or other qualified healthcare
            professional.
          </Callout>
        </Sub>
        <Sub title="4.4 Withdrawing consent">
          <p>
            You can withdraw consent at any time from Settings → BraidCare Data → Consent.
            Withdrawal stops all future photograph processing immediately. It does not delete your
            existing reports or photographs unless you separately request deletion (Section 8).
          </p>
        </Sub>
      </Section>

      <Section n="5" title="Who We Share Your Data With">
        <p>We do not sell your personal data. We share it only with:</p>
        <KeyList
          items={[
            [
              "Supabase",
              "Database, authentication and file storage — core infrastructure (EU region).",
            ],
            ["Stripe", "Payment processing and braider payouts (PCI DSS Level 1 certified)."],
            [
              "Anthropic",
              "Scalp photographs (BraidCare) and inspiration photos (style matching), processed transiently in the US under UK ICO-approved Standard Contractual Clauses; not retained for training.",
            ],
            ["Resend", "Transactional email delivery."],
            ["Netlify", "Hosting infrastructure."],
            [
              "Partner insurers / experts",
              "Only when you actively click through (insurance) or consent to a specific referral (experts — flag summary only, never photographs).",
            ],
            ["Regulators / law enforcement", "As legally required."],
          ]}
        />
      </Section>

      <Section n="6" title="International Data Transfers">
        <p>
          Most of your data is stored and processed within the UK or EU. Where data is transferred
          outside the UK — principally to Anthropic (United States) — we rely on Standard
          Contractual Clauses approved by the UK ICO, together with Anthropic&rsquo;s own data
          protection commitments.
        </p>
      </Section>

      <Section n="7" title="How Long We Keep Your Data">
        <KeyList
          items={[
            [
              "Account data",
              "While your account is active, plus 30 days after a deletion request.",
            ],
            [
              "Booking & payment records",
              "7 years from the transaction date (HMRC record-keeping).",
            ],
            [
              "BraidCare photographs",
              "90 days from upload, or until you delete them — whichever is sooner.",
            ],
            [
              "BraidCare reports (text only)",
              "Retained as part of your account history until account deletion.",
            ],
            ["Braidr Pro tax/insurance documents", "7 years (HMRC self-assessment obligations)."],
            ["Marketing consent records", "Until withdrawn, plus a record of the withdrawal."],
            ["Server & security logs", "12 months."],
            ["Dispute & support correspondence", "3 years from resolution."],
          ]}
        />
      </Section>

      <Section n="8" title="Your Rights">
        <p>
          Under UK GDPR you have the rights to access, rectification, erasure, restriction,
          portability, objection, and to withdraw consent. To exercise any of them, use the relevant
          control in Settings or email privacy@braidr.app:
        </p>
        <KeyList
          items={[
            ["Access / Portability", "Settings → Privacy → Download my data (JSON/CSV export)."],
            [
              "Rectification",
              "Edit directly in Settings, or email us for data you cannot self-edit.",
            ],
            [
              "Erasure",
              "Settings → Account → Delete account (subject to the legal retention periods in Section 7).",
            ],
            ["Objection / marketing", "Settings → Notifications (marketing toggle)."],
            ["Withdraw BraidCare consent", "Settings → BraidCare Data → Consent."],
            ["Cookie preferences", "The &ldquo;Cookie preferences&rdquo; link in the site footer."],
          ]}
        />
        <p>
          You also have the right to complain to the UK Information Commissioner&rsquo;s Office
          (ico.org.uk) — though we&rsquo;d appreciate the chance to resolve any concern directly
          first. When you delete your account we delete or anonymise your personal data within 30
          days, except where we are legally required to retain specific records.
        </p>
      </Section>

      <Section n="9" title="Cookies">
        <KeyList
          items={[
            [
              "Essential / session",
              "Keeps you logged in; required for the Platform to function. Session or up to 7 days. No consent required.",
            ],
            [
              "Referral tracking",
              "Records which user's referral link brought you to Braidr. 30 days. Legitimate interest; anonymous until you register.",
            ],
            [
              "Analytics",
              "Helps us understand how the Platform is used. Set only if you choose &ldquo;Accept all&rdquo; on the cookie banner; you can decline.",
            ],
            ["Marketing / advertising", "Not currently used."],
          ]}
        />
        <p>
          You can manage your cookie preferences at any time via the &ldquo;Cookie
          preferences&rdquo; link in the site footer.
        </p>
      </Section>

      <Section n="10" title="Children's Data">
        <p>
          Braidr is intended for use by adults aged 18 and over. We do not knowingly collect
          personal data from anyone under 18. If we become aware that a user is under 18 we will
          suspend the account and delete the associated data, except where retention is required by
          law.
        </p>
      </Section>

      <Section n="11" title="Data Security">
        <p>
          We apply encryption in transit (TLS 1.3) and at rest (AES-256), Row-Level Security on
          every database table, private storage for scalp photographs with time-limited signed URLs,
          and no storage of full payment card details on our own infrastructure. No system can be
          guaranteed 100% secure, but we commit to notifying the ICO and affected users of any
          breach likely to result in a risk to your rights and freedoms, within the timeframes
          required by law (72 hours to the ICO where feasible).
        </p>
      </Section>

      <Section n="12" title="Changes To This Policy">
        <p>
          We may update this policy from time to time. We will note the date of the most recent
          update at the top, and where a change is material we will notify you by email or an in-app
          notice before it takes effect.
        </p>
      </Section>

      <Section n="13" title="Contact Us">
        <p>
          Data controller: Braidr Ltd. Privacy contact: privacy@braidr.app (placeholder — confirm
          before launch). Supervisory authority: the Information Commissioner&rsquo;s Office (ICO),
          United Kingdom — ico.org.uk.
        </p>
      </Section>
    </LegalDoc>
  );
}
