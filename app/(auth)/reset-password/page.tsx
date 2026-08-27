"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api.post("/auth/reset-password", { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
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
