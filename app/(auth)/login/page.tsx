"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ContinueWithGoogle, OrDivider } from "@/components/auth/continue-with-google";
import { api, ApiError } from "@/lib/api/client";
import { DASHBOARD_PATH, type SessionUser } from "@/lib/hooks/use-session";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const redirectTo = params.get("redirect");
  const oauthFailed = params.get("error") === "oauth";
  const accountDeleted = params.get("deleted") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    setPending(true);
    try {
      await api.post("/auth/login", { email, password });
      const session = await api.get<SessionUser>("/auth/session");
      queryClient.setQueryData(["session"], session);
      const dest =
        redirectTo ??
        (session.profile ? DASHBOARD_PATH[session.profile.role] : "/dashboard/client");
      router.replace(dest);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.field) setFieldError(err.message);
        else setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-plum">Sign in</h1>
      <p className="mt-1 text-sm text-slate">Welcome back to Braidr.</p>

      {oauthFailed && (
        <div className="mt-4">
          <Alert tone="error">Google sign-in didn&rsquo;t complete. Please try again.</Alert>
        </div>
      )}
      {accountDeleted && (
        <div className="mt-4">
          <Alert tone="info">
            Your account has been deleted. Personal data is removed within 30 days.
          </Alert>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <ContinueWithGoogle />
        <OrDivider />
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldError}
        />
        <div className="text-right text-sm">
          <Link href="/forgot-password" className="text-teal-deep underline hover:text-plum">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate">
        New to Braidr?{" "}
        <Link href="/register" className="font-medium text-teal-deep underline hover:text-plum">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
