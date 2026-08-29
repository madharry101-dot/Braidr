"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { CookiePreferencesLink } from "@/components/legal/cookie-preferences-link";
import { api, ApiError } from "@/lib/api/client";

export function PrivacySection() {
  const { data, refetch } = useQuery({
    queryKey: ["settings", "export"],
    queryFn: () =>
      api.get<{ pending: { requested_at: string } | null }>("/settings/privacy/export"),
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function requestExport() {
    setPending(true);
    setError(null);
    try {
      await api.post("/settings/privacy/export");
      setDone(true);
      refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const alreadyRequested = done || Boolean(data?.pending);

  return (
    <Card>
      <CardTitle>Privacy</CardTitle>
      <div className="mt-3 flex flex-col gap-4 text-sm">
        <div>
          <p className="font-medium text-plum">Cookies</p>
          <CookiePreferencesLink className="text-teal-deep underline hover:text-plum" />
        </div>

        <div>
          <p className="font-medium text-plum">Download your data</p>
          <p className="text-slate">
            Get a copy of the personal data we hold about you — bookings, BraidCare reports, and
            account details.
          </p>
          {error && (
            <Alert tone="error" className="mt-2">
              {error}
            </Alert>
          )}
          {alreadyRequested ? (
            <p className="mt-2 text-slate">
              We&rsquo;ve started preparing your data. We&rsquo;ll email you a secure download link
              within 48 hours.
            </p>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="mt-2 sm:!w-auto"
              loading={pending}
              onClick={requestExport}
            >
              Request my data
            </Button>
          )}
        </div>

        <div>
          <p className="font-medium text-plum">Policy</p>
          <Link href="/privacy" className="text-teal-deep underline hover:text-plum">
            Read the Privacy Policy
          </Link>
        </div>
      </div>
    </Card>
  );
}
