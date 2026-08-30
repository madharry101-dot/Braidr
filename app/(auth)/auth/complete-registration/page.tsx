"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { BrSelect } from "@/components/braidr-ui/form";
import { BrButton } from "@/components/braidr-ui/button";
import { Alert } from "@/components/ui/alert";
import { ConsentFields } from "@/components/auth/consent-fields";
import { api, ApiError } from "@/lib/api/client";
import { readReferralCookie } from "@/lib/referral/cookie";
import { useSession, type SessionUser } from "@/lib/hooks/use-session";

type RoleOption = "client" | "braider" | "expert";

const ROLE_HINT: Record<RoleOption, string> = {
  client: "Book braiders and monitor your scalp health.",
  braider: "Take bookings, build a profile, track income. Extra verification needed.",
  expert: "Clinical reviewer for the Expert Network. Credential check required.",
};

// GDPR-09 — after returning from Google, a new account still needs a role
// and explicit Terms/Privacy consent before it's created.
export default function CompleteRegistrationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isLoading } = useSession();

  const [role, setRole] = useState<RoleOption>("client");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // No session -> nothing to complete. Already has a profile -> done.
  useEffect(() => {
    if (isLoading) return;
    if (!session) router.replace("/login");
    else if (session.profile) router.replace("/dashboard");
  }, [isLoading, session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTermsError(null);
    setFormError(null);
    if (!acceptedTerms) {
      setTermsError("You must accept the Terms and Privacy Policy to continue.");
      return;
    }
    setPending(true);
    try {
      await api.post("/auth/complete-oauth-registration", {
        role,
        accepted_terms: true,
        marketing_opt_in: marketingOptIn,
        referred_by: readReferralCookie(),
      });
      const fresh = await api.get<SessionUser>("/auth/session");
      queryClient.setQueryData(["session"], fresh);
      router.replace("/dashboard");
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again."
      );
      setPending(false);
    }
  }

  if (isLoading || !session || session.profile) return null;

  return (
    <div>
      <h1 className="br-display text-2xl">You&rsquo;re almost done</h1>
      <p className="mt-1 br-muted text-sm">
        We&rsquo;ll set up your Braidr account using your Google name and email. Choose how
        you&rsquo;d like to use Braidr.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <BrSelect
          label="I'm joining as"
          value={role}
          onChange={(e) => setRole(e.target.value as RoleOption)}
          hint={ROLE_HINT[role]}
        >
          <option value="client">A client</option>
          <option value="braider">A braider</option>
          <option value="expert">A clinical expert</option>
        </BrSelect>

        <ConsentFields
          acceptedTerms={acceptedTerms}
          onAcceptedTermsChange={setAcceptedTerms}
          marketingOptIn={marketingOptIn}
          onMarketingOptInChange={setMarketingOptIn}
          termsError={termsError}
          disabled={pending}
        />

        <BrButton
          type="submit"
         
          loading={pending}
          disabled={!acceptedTerms}
          className="w-full"
        >
          Complete registration
        </BrButton>
      </form>
    </div>
  );
}
