"use client";

import { useState } from "react";
import Link from "next/link";
import { BrInput } from "@/components/braidr-ui/form";
import { BrButton } from "@/components/braidr-ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api/client";

// R-08: the API no longer reports whether an address is a Google-only
// account — that answer was an account-existence oracle for anyone who could
// POST this form. A Google-only user is told by email instead. Every address,
// registered or not, now gets the same { sent: true } and the same screen.
type Result = { sent: boolean };

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
