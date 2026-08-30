"use client";

import { useState } from "react";
import Link from "next/link";
import { BrInput } from "@/components/braidr-ui/form";
import { BrButton } from "@/components/braidr-ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api/client";

type Result = { sent: boolean; google_only: boolean };

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await api.post<Result>("/auth/reset-password", { email });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  // FR-AUTH-02.6 — Google-only account: a reset link is no use to them.
  if (result?.google_only) {
    return (
      <div>
        <h1 className="br-display text-2xl">Use Google to sign in</h1>
        <p className="br-muted mt-3 text-sm">
          The account for <span className="font-medium">{email}</span> was created with Google and
          doesn&rsquo;t have a password. Go back and choose{" "}
          <span className="font-medium">Continue with Google</span>.
        </p>
        <Link href="/login" className="br-link mt-6 inline-block font-medium underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  if (result?.sent) {
    return (
      <div>
        <h1 className="br-display text-2xl">Check your email</h1>
        <p className="br-muted mt-3 text-sm">
          If an account exists for <span className="font-medium">{email}</span>, we&rsquo;ve sent a
          link to reset your password. The link expires in one hour.
        </p>
        <Link href="/login" className="br-link mt-6 inline-block font-medium underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="br-display text-2xl">Reset your password</h1>
      <p className="br-muted mt-1 text-sm">
        Enter your email and we&rsquo;ll send you a reset link.
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <BrInput
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <BrButton type="submit" loading={pending} className="w-full">
          Send reset link
        </BrButton>
      </form>
      <p className="br-muted mt-6 text-center text-sm">
        <Link href="/login" className="br-link font-medium underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
