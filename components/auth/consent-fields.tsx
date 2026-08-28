"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";

// GDPR-01 + GDPR-02 (Consent Library) — exact wording. Both unchecked by
// default; Terms gates the submit button; marketing is never a condition of
// registering and never bundled with Terms.
export function ConsentFields({
  acceptedTerms,
  onAcceptedTermsChange,
  marketingOptIn,
  onMarketingOptInChange,
  termsError,
  disabled,
}: {
  acceptedTerms: boolean;
  onAcceptedTermsChange: (v: boolean) => void;
  marketingOptIn: boolean;
  onMarketingOptInChange: (v: boolean) => void;
  termsError?: string | null;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Checkbox
        checked={acceptedTerms}
        onChange={(e) => onAcceptedTermsChange(e.target.checked)}
        disabled={disabled}
        error={termsError}
        label={
          <>
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="underline hover:text-teal-deep">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="underline hover:text-teal-deep">
              Privacy Policy
            </Link>
          </>
        }
      />
      <Checkbox
        checked={marketingOptIn}
        onChange={(e) => onMarketingOptInChange(e.target.checked)}
        disabled={disabled}
        label="Send me occasional emails about new features, offers, and braiding tips (you can unsubscribe anytime)"
      />
    </div>
  );
}
