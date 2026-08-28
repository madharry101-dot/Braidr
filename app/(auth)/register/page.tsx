"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ConsentFields } from "@/components/auth/consent-fields";
import { ContinueWithGoogle, OrDivider } from "@/components/auth/continue-with-google";
import { api, ApiError } from "@/lib/api/client";
import { DASHBOARD_PATH, type SessionUser } from "@/lib/hooks/use-session";

type RoleOption = "client" | "braider" | "expert";

const ROLE_HINT: Record<RoleOption, string> = {
  client: "Book braiders and monitor your scalp health.",
  braider: "Take bookings, build a profile, track income. Extra verification needed.",
  expert: "Clinical reviewer for the Expert Network. Credential check required.",
};

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleOption>("client");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    if (!acceptedTerms) {
      setErrors({ accepted_terms: "You must accept the Terms and Privacy Policy to register." });
      return;
    }
    setPending(true);
    try {
      const res = await api.post<{ user_id: string; email_confirmation_required: boolean }>(
        "/auth/register",
        {
          full_name: fullName,
          email,
          password,
          role,
          accepted_terms: true,
          marketing_opt_in: marketingOptIn,
        }
      );
      if (res.email_confirmation_required) {
        setConfirmSent(true);
        setPending(false);
        return;
      }
      const session = await api.get<SessionUser>("/auth/session");
      queryClient.setQueryData(["session"], session);
      router.replace(session.profile ? DASHBOARD_PATH[session.profile.role] : "/dashboard/client");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.field) setErrors({ [err.field]: err.message });
        else setFormError(err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setPending(false);
    }
  }

  if (confirmSent) {
    return (
      <div>
        <h1 className="font-display text-2xl text-plum">Check your email</h1>
        <p className="mt-3 text-sm text-slate">
          We&rsquo;ve sent a confirmation link to{" "}
          <span className="font-medium text-plum">{email}</span>. Click it to activate your account,
          then sign in.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block font-medium text-teal-deep underline hover:text-plum"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-plum">Create your account</h1>
      <p className="mt-1 text-sm text-slate">One account for booking, BraidCare and Pro.</p>

      <div className="mt-6 flex flex-col gap-3">
        <ContinueWithGoogle label="Sign up with Google" />
        <OrDivider />
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Input
          label="Full name"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.full_name}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Select
          label="I'm joining as"
          value={role}
          onChange={(e) => setRole(e.target.value as RoleOption)}
          hint={ROLE_HINT[role]}
          error={errors.role}
        >
          <option value="client">A client</option>
          <option value="braider">A braider</option>
          <option value="expert">A clinical expert</option>
        </Select>

        <ConsentFields
          acceptedTerms={acceptedTerms}
          onAcceptedTermsChange={setAcceptedTerms}
          marketingOptIn={marketingOptIn}
          onMarketingOptInChange={setMarketingOptIn}
          termsError={errors.accepted_terms}
          disabled={pending}
        />

        <Button
          type="submit"
          size="lg"
          loading={pending}
          disabled={!acceptedTerms}
          className="w-full"
        >
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-teal-deep underline hover:text-plum">
          Sign in
        </Link>
      </p>
    </div>
  );
}
