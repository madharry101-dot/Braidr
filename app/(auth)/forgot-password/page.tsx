"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
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
        <h1 className="font-display text-2xl text-plum">Use Google to sign in</h1>
        <p className="mt-3 text-sm text-slate">
          The account for <span className="font-medium text-plum">{email}</span> was created with
          Google and doesn&rsquo;t have a password. Go back and choose{" "}
          <span className="font-medium text-plum">Continue with Google</span>.
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

  if (result?.sent) {
    return (
      <div>
        <h1 className="font-display text-2xl text-plum">Check your email</h1>
        <p className="mt-3 text-sm text-slate">
          If an account exists for <span className="font-medium text-plum">{email}</span>,
          we&rsquo;ve sent a link to reset your password. The link expires in one hour.
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
      <h1 className="font-display text-2xl text-plum">Reset your password</h1>
      <p className="mt-1 text-sm text-slate">
        Enter your email and we&rsquo;ll send you a reset link.
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate">
        <Link href="/login" className="font-medium text-teal-deep underline hover:text-plum">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
