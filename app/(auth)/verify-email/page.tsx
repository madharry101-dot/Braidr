"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { api } from "@/lib/api/client";

type State = "checking" | "ok" | "error" | "missing";

function VerifyEmail() {
  const params = useSearchParams();
  const [state, setState] = useState<State>("checking");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token_hash = params.get("token_hash");
    const type = params.get("type");
    if (!token_hash || !type) {
      setState("missing");
      return;
    }
    api
      .post("/auth/verify-email", { token_hash, type })
      .then(() => setState("ok"))
      .catch(() => setState("error"));
  }, [params]);

  if (state === "checking") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-plum border-t-transparent" />
        <p className="text-sm text-slate">Confirming your email&hellip;</p>
      </div>
    );
  }

  if (state === "ok") {
    return (
      <div>
        <h1 className="font-display text-2xl text-plum">Email confirmed</h1>
        <p className="mt-3 text-sm text-slate">Your account is active. You can sign in now.</p>
        <Link
          href="/login"
          className="mt-6 inline-block font-medium text-teal-deep underline hover:text-plum"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-plum">Couldn&rsquo;t confirm your email</h1>
      <Alert tone="error" className="mt-4">
        {state === "missing"
          ? "This page needs a confirmation link from your email."
          : "This confirmation link is invalid or has expired."}
      </Alert>
      <Link
        href="/login"
        className="mt-6 inline-block font-medium text-teal-deep underline hover:text-plum"
      >
        Back to sign in
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}
