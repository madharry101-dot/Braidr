"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Scissors, User } from "lucide-react";
import { BrInput } from "@/components/braidr-ui/form";
import { BrButton } from "@/components/braidr-ui/button";
import { BrRoleSelector, type BrRoleOption } from "@/components/braidr-ui/form";
import { Alert } from "@/components/ui/alert";
import { ConsentFields } from "@/components/auth/consent-fields";
import { ContinueWithGoogle, OrDivider } from "@/components/auth/continue-with-google";
import { api, ApiError } from "@/lib/api/client";
import { readReferralCookie } from "@/lib/referral/cookie";
import { DASHBOARD_PATH, type SessionUser } from "@/lib/hooks/use-session";

type RoleOption = "client" | "braider" | "expert";

const ROLE_HINT: Record<RoleOption, string> = {
  client: "Book braiders and monitor your scalp health.",
  braider: "Take bookings, build a profile, track income. Extra verification needed.",
  expert: "Clinical reviewer for the Expert Network. Credential check required.",
};

/*
 * The two approved role cards (component library, Section B).
 *
 * `expert` deliberately has NO card. It is a real account type in the
 * registration logic, but no card was designed for it in Phase 1 — the
 * same situation the handoff calls out for salon/business accounts, and
 * handled the same way: preserved functionally below the cards, with no
 * invented UI. It needs its own design pass before it gets one.
 */
const ROLE_CARDS: ReadonlyArray<BrRoleOption<RoleOption>> = [
  {
    value: "client",
    icon: <User size={22} aria-hidden="true" />,
    title: "I'm a client",
    description: "Find a braider, book, and keep an eye on your scalp.",
  },
  {
    value: "braider",
    icon: <Scissors size={22} aria-hidden="true" />,
    title: "I'm a braider",
    description: "Take bookings, get verified, and build the business.",
  },
];

function isRole(value: string | null): value is RoleOption {
  return value === "client" || value === "braider" || value === "expert";
}

function RegisterForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // The homepage's braider CTAs link to /register?role=braider, so the
  // doorway a visitor came through preselects the matching card.
  const initialRole = params.get("role");
  const [role, setRole] = useState<RoleOption>(isRole(initialRole) ? initialRole : "client");
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
          referred_by: readReferralCookie(),
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
        <h1 className="br-display text-2xl">Check your email</h1>
        <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
          We&rsquo;ve sent a confirmation link to <span className="font-medium">{email}</span>. Click
          it to activate your account, then sign in.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block font-medium underline"
          style={{ color: "var(--gold-ink)" }}
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="br-display text-2xl">Create your account</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        One account for booking, BraidCare and Pro.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <ContinueWithGoogle label="Sign up with Google" />
        <OrDivider />
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <BrInput
          label="Full name"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.full_name}
        />
        <BrInput
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <BrInput
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

        <div>
          <span className="br-label">I&rsquo;m joining as</span>
          <BrRoleSelector
            label="I'm joining as"
            options={ROLE_CARDS}
            value={role}
            onChange={setRole}
            disabled={pending}
          />
          {role === "expert" ? (
            <div
              className="mt-3 rounded p-3 text-sm"
              style={{ background: "var(--brand-sand)", borderRadius: "var(--radius-md)" }}
            >
              <p className="font-medium">Registering as a clinical expert</p>
              <p className="mt-1" style={{ color: "var(--text-muted)" }}>
                {ROLE_HINT.expert}
              </p>
              <button
                type="button"
                onClick={() => setRole("client")}
                className="mt-2 underline"
                style={{ color: "var(--gold-ink)" }}
              >
                Choose a different account type
              </button>
            </div>
          ) : (
            <>
              <span className="br-help">{ROLE_HINT[role]}</span>
              <button
                type="button"
                onClick={() => setRole("expert")}
                className="br-help underline"
                style={{ color: "var(--gold-ink)" }}
              >
                Joining as a clinical expert instead?
              </button>
            </>
          )}
          {errors.role && <span className="br-err">{errors.role}</span>}
        </div>

        <ConsentFields
          acceptedTerms={acceptedTerms}
          onAcceptedTermsChange={setAcceptedTerms}
          marketingOptIn={marketingOptIn}
          onMarketingOptInChange={setMarketingOptIn}
          termsError={errors.accepted_terms}
          disabled={pending}
        />

        <BrButton type="submit" loading={pending} disabled={!acceptedTerms} className="w-full">
          Create account
        </BrButton>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline" style={{ color: "var(--gold-ink)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  // useSearchParams needs a Suspense boundary, same as /login.
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
