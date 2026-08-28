import { LegalDoc, Section, Sub, KeyList, Callout } from "@/components/legal/legal-doc";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" updated="August 2026">
      <Section n="1" title="Acceptance of These Terms">
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) form a legally binding agreement between you
          and Braidr Ltd (&ldquo;Braidr&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;,
          &ldquo;our&rdquo;), a company registered in the United Kingdom. By creating an account or
          using the Platform, you agree to be bound by these Terms and by our Privacy Policy.
        </p>
        <p>
          You must be at least 18 years old and resident in the United Kingdom to use Braidr. By
          registering, you confirm that this is true.
        </p>
      </Section>

      <Section n="2" title="What Braidr Is — and What It Is Not">
        <Sub title="2.1 Braidr is a marketplace, not a braiding service provider">
          <p>
            Braidr operates a technology platform connecting clients with independent braiding
            professionals (&ldquo;Braiders&rdquo;). Braiders are independent contractors, not
            employees or agents of Braidr. The contract for braiding services is formed directly
            between the client and the Braider; Braidr is not a party to it and does not provide
            braiding services itself.
          </p>
          <p>
            Braidr is not responsible for the quality, safety, timeliness, or legality of any
            braiding service. Disputes about the service itself are between the client and the
            Braider. Braidr provides a dispute support process (Section 8) as a courtesy but does
            not guarantee any particular outcome.
          </p>
        </Sub>
        <Sub title="2.2 BraidCare is a wellness monitoring tool, not a medical service">
          <Callout>
            BraidCare does not diagnose, treat, or provide medical advice for any condition. It
            provides general observational information based on photographs you submit, generated
            using artificial intelligence, for informational and wellness purposes only.
          </Callout>
          <p>
            You must not rely on BraidCare as a substitute for professional medical advice,
            diagnosis, or treatment. To the maximum extent permitted by law, Braidr excludes all
            liability for any decision made, or harm suffered, in reliance on a BraidCare report.
          </p>
        </Sub>
        <Sub title="2.3 Braidr Pro is informational guidance, not professional advice">
          <p>
            Braidr Pro provides general guidance about registering as self-employed, obtaining
            insurance, and managing a business. It is not tax, legal, financial, or insurance
            advice. You are solely responsible for your own compliance with HMRC, insurance, and
            other legal obligations. Braidr&rsquo;s income tracking tools are for convenience only
            and are not a certified accounting record.
          </p>
        </Sub>
        <Sub title="2.4 The Expert Network connects you with independent professionals">
          <p>
            Clinical experts in the Expert Network are independent professionals, not employees or
            agents of Braidr. Braidr facilitates the introduction only. Any consultation, diagnosis,
            treatment, or advice is provided by that expert directly, under their own professional
            responsibility, and is not provided by Braidr.
          </p>
        </Sub>
      </Section>

      <Section n="3" title="Your Account">
        <p>
          You must provide accurate, current, and complete information and keep it up to date. You
          are responsible for the confidentiality of your password and for all activity under your
          account, and must notify us at support@braidr.app if you suspect unauthorised use. One
          person may not hold more than one account per role, except where Braidr explicitly permits
          it (for example, someone who is both a client and a braider). Braidr may suspend or
          terminate any account that violates these Terms or engages in fraudulent, abusive, or
          illegal conduct.
        </p>
      </Section>

      <Section n="4" title="Bookings, Payments, and Cancellations">
        <Sub title="4.1 Booking and payment">
          <p>
            Payment is collected at the time of booking and held by our payment processor, Stripe,
            on Braidr&rsquo;s behalf. Payment is released to the Braider 24 hours after the
            scheduled appointment time, subject to the appointment being marked complete and no
            dispute being raised.
          </p>
        </Sub>
        <Sub title="4.2 Platform commission">
          <p>
            Braidr charges a commission on each completed booking: 12% of the booking value for
            standard accounts, reduced to 5% for Braiders subscribed to Braidr Pro. This is deducted
            before the balance is transferred to the Braider.
          </p>
        </Sub>
        <Sub title="4.3 Cancellation policy">
          <KeyList
            items={[
              ["48 hours or more before", "Full refund to the client."],
              ["Between 24 and 48 hours before", "50% refund."],
              ["Less than 24 hours before", "No refund."],
              [
                "Braider cancels a confirmed booking",
                "Client receives a full refund regardless of notice; repeated Braider cancellations may lead to suspension.",
              ],
            ]}
          />
        </Sub>
        <Sub title="4.4 Subscriptions">
          <p>
            Braidr Pro (£35/month) and BraidCare subscriptions (£7.99/month for clients,
            £14.99/month for Braiders) are billed monthly in advance via Stripe and can be cancelled
            at any time from your account settings. Cancellation takes effect at the end of the
            current billing period; no partial refunds are given for a period already paid for.
          </p>
        </Sub>
        <Sub title="4.5 Disputes">
          <p>
            If you believe a booking was not completed as agreed, you may raise a dispute through
            the Platform within 7 days of the appointment. Braidr will review it and may, at its
            sole discretion, issue a partial or full refund. Braidr&rsquo;s decision is final as
            between Braidr and the party raising the dispute, but does not affect any legal rights
            either party may have directly against the other.
          </p>
        </Sub>
      </Section>

      <Section n="5" title="Braider Obligations">
        <p>If you register as a Braider, you additionally agree that:</p>
        <ul className="list-disc pl-5">
          <li>
            You are responsible for your own tax affairs, including registering as self-employed
            with HMRC where required by law.
          </li>
          <li>
            You are responsible for obtaining any insurance, qualifications, or certifications
            required to lawfully and safely provide braiding services.
          </li>
          <li>Your public profile information is accurate and kept up to date.</li>
          <li>
            You will provide services with reasonable skill and care, safely and hygienically.
          </li>
          <li>
            Braidr may suspend or remove your profile following our standard review process if we
            receive credible reports of unsafe practice, fraud, or repeated client complaints.
          </li>
        </ul>
      </Section>

      <Section n="6" title="Prohibited Conduct">
        <p>You must not use the Platform to:</p>
        <ul className="list-disc pl-5">
          <li>
            Circumvent Braidr&rsquo;s payment system by arranging payment for a Braidr-sourced
            booking outside the Platform.
          </li>
          <li>Post false, misleading, or defamatory content, including fake reviews.</li>
          <li>Harass, threaten, or discriminate against another user.</li>
          <li>
            Upload any photograph that is not your own, or that depicts another person without their
            consent, for BraidCare analysis.
          </li>
          <li>Attempt to access another user&rsquo;s account or data without authorisation.</li>
          <li>Use automated tools to scrape, copy, or extract data from the Platform.</li>
          <li>
            Impersonate any person or entity, or misrepresent your professional qualifications.
          </li>
        </ul>
      </Section>

      <Section n="7" title="Intellectual Property">
        <p>
          The Braidr name, logo, and Platform design are the property of Braidr Ltd. You retain
          ownership of the content you upload (photographs, portfolio images, reviews), but you
          grant Braidr a licence to store, display, and process that content as necessary to provide
          the service.
        </p>
      </Section>

      <Section n="8" title="Limitation of Liability">
        <Callout>
          This section limits Braidr&rsquo;s financial exposure and should be reviewed by a
          solicitor for enforceability under UK consumer protection law before publication.
        </Callout>
        <p>To the maximum extent permitted by law:</p>
        <ul className="list-disc pl-5">
          <li>
            Braidr&rsquo;s total liability to you for any claim arising from your use of the
            Platform is limited to the greater of £100 or the total fees you paid to Braidr in the
            12 months preceding the claim.
          </li>
          <li>
            Braidr is not liable for any indirect, incidental, special, or consequential loss,
            including loss of profit, business opportunity, or data.
          </li>
          <li>
            Nothing in these Terms excludes or limits Braidr&rsquo;s liability for death or personal
            injury caused by our negligence, for fraud, or for any other liability that cannot be
            excluded under UK law.
          </li>
          <li>
            Braidr is not liable for the acts or omissions of Braiders, clinical experts, or other
            independent third parties, as set out in Section 2.
          </li>
        </ul>
      </Section>

      <Section n="9" title="Indemnity">
        <p>
          You agree to indemnify and hold Braidr harmless from any claim, loss, or damage (including
          reasonable legal fees) arising from your breach of these Terms, your misuse of the
          Platform, or your violation of any law or third-party right.
        </p>
      </Section>

      <Section n="10" title="Referral Programme">
        <p>
          Registered users receive a unique referral link they may share. Rewards for successful
          referrals, where introduced, will be described separately at the time they launch and are
          subject to change or withdrawal by Braidr. Misuse of the referral programme (for example,
          self-referral, fraudulent registrations, or automated referral generation) voids any
          associated reward and may result in account suspension.
        </p>
      </Section>

      <Section n="11" title="Termination">
        <p>
          You may close your account at any time from Settings. Braidr may suspend or terminate your
          account, with or without notice, if we reasonably believe you have breached these Terms or
          posed a risk to another user or to Braidr. On termination, any outstanding payments owed
          to a Braider for completed bookings will still be paid out, and any refunds properly owed
          to a client will still be processed.
        </p>
      </Section>

      <Section n="12" title="Changes to These Terms">
        <p>
          We may update these Terms from time to time. Where a change is material, we will notify
          you by email or in-app notice at least 14 days before it takes effect. Continued use of
          the Platform after a change takes effect constitutes acceptance of the updated Terms.
        </p>
      </Section>

      <Section n="13" title="Governing Law">
        <p>
          These Terms are governed by the laws of England and Wales, and any dispute will be subject
          to the exclusive jurisdiction of the courts of England and Wales — save that nothing here
          removes any statutory right you have as a consumer to bring a claim in your local court.
        </p>
      </Section>

      <Section n="14" title="Contact Us">
        <p>
          Braidr Ltd. Support: support@braidr.app. Legal / Terms queries: legal@braidr.app (both
          placeholders — confirm before launch).
        </p>
      </Section>
    </LegalDoc>
  );
}
