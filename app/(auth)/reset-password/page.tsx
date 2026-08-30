"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrInput } from "@/components/braidr-ui/form";
import { BrButton } from "@/components/braidr-ui/button";
import { Alert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";

// PRD v2.0 §4.11 — /reset-password is the "set a new password" page reached
// from the emailed recovery link (the request form is /forgot-password).
// The browser client (detectSessionInUrl) turns the URL token into a
// temporary session; we then set the new password with updateUser().
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkValid, setLinkValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setLinkValid(Boolean(data.session));
      setReady(true);
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setPending(false);
      return;
    }
    await supabase.auth.signOut();
    setDone(true);
    setTimeout(() => router.replace("/login"), 2000);
  }

  if (!ready) return null;

  if (done) {
    return (
      <div>
        <h1 className="br-display text-2xl">Password updated</h1>
        <p className="mt-3 br-muted text-sm">Taking you to the sign-in page&hellip;</p>
      </div>
    );
  }

  if (!linkValid) {
    return (
      <div>
        <h1 className="br-display text-2xl">Link expired</h1>
        <p className="mt-3 br-muted text-sm">
          This reset link is invalid or has already been used. Request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block font-medium br-link underline"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="br-display text-2xl">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <BrInput
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <BrInput
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <BrButton type="submit" loading={pending} className="w-full">
          Update password
        </BrButton>
      </form>
    </div>
  );
}
