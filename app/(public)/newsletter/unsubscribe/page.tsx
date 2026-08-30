"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/brand/site-footer";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";

// Login-free unsubscribe (PECR reg. 23). Reached from the link in every
// newsletter email.
//
// The click does NOT unsubscribe on page load: mail clients and security
// scanners pre-fetch links, and a GET that changes state would unsubscribe
// people who never clicked. The page asks, and the POST does the work.

function Unsubscribe() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");

  useEffect(() => {
    if (!token) setState("error");
  }, [token]);

  async function confirm() {
    setState("working");
    try {
      const res = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <Card>
      <CardTitle>Unsubscribe from educational emails</CardTitle>

      {state === "done" ? (
        <>
          <Alert tone="success" className="mt-4">
            You&rsquo;re unsubscribed. You won&rsquo;t get any more educational emails from us.
          </Alert>
          <p className="mt-3 text-sm text-slate">
            This doesn&rsquo;t affect emails about your own bookings or BraidCare checks — those
            are part of the service, and you can manage them in{" "}
            <Link href="/settings" className="text-teal-deep underline">
              Settings
            </Link>
            .
          </p>
        </>
      ) : state === "error" ? (
        <>
          <Alert tone="error" className="mt-4">
            {token
              ? "Something went wrong. Please try again."
              : "This link is missing its unsubscribe code."}
          </Alert>
          <p className="mt-3 text-sm text-slate">
            You can also turn these off in{" "}
            <Link href="/settings" className="text-teal-deep underline">
              Settings
            </Link>{" "}
            once signed in.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate">
            Confirm below and we&rsquo;ll stop sending you emails about new educational content.
            Emails about your own bookings and BraidCare checks aren&rsquo;t affected.
          </p>
          <Button
            className="mt-4 sm:!w-auto"
            loading={state === "working"}
            onClick={confirm}
          >
            Unsubscribe me
          </Button>
        </>
      )}
    </Card>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-content items-center px-4 lg:px-8">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 lg:px-8">
        <Suspense fallback={<LoadingBlock />}>
          <Unsubscribe />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
