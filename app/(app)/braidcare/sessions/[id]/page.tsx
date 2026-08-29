"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock, Spinner } from "@/components/ui/spinner";
import { PhotoGuidance } from "@/components/braidcare/photo-guidance";
import { PhotoCapture } from "@/components/braidcare/photo-capture";
import { PhotoConsentScreen } from "@/components/braidcare/photo-consent-screen";
import { BraidcareReport } from "@/components/braidcare/report";
import { BraidcareDisclaimer } from "@/components/braidcare/disclaimer";
import {
  useBraidcareSession,
  useAnalyseBraidcareSession,
  usePhotoConsent,
} from "@/lib/hooks/braidcare";
import { ApiError } from "@/lib/api/client";

function Analysing() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <Spinner className="mx-auto h-8 w-8 text-plum" />
      <p className="mt-4 font-display text-xl text-plum">Checking your photos…</p>
      <p className="mt-1 text-sm text-slate">
        This usually takes under a minute. You can leave this page — we&rsquo;ll email you when the
        report is ready.
      </p>
    </div>
  );
}

export default function BraidcareSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isLoading, isError, error } = useBraidcareSession(id);
  const analyse = useAnalyseBraidcareSession(id);
  const consent = usePhotoConsent();

  const [photoCountOverride, setPhotoCountOverride] = useState<number | null>(null);
  const [queued, setQueued] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const photoCount = photoCountOverride ?? session?.photos_count ?? 0;

  if (isLoading) return <LoadingBlock label="Loading session" />;
  if (isError || !session) {
    return <Alert tone="error">{error?.message ?? "This session could not be found."}</Alert>;
  }

  if (session.status === "completed") {
    return <BraidcareReport session={session} />;
  }

  if (session.status === "in_progress" || queued) {
    return <Analysing />;
  }

  if (session.status === "expired") {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <h1 className="font-display text-2xl text-plum">Session expired</h1>
        <p className="mt-2 text-slate">
          This session window has closed. Start a new one from your BraidCare page.
        </p>
        <Link
          href="/braidcare"
          className="mt-4 inline-block font-medium text-teal-deep underline hover:text-plum"
        >
          Back to BraidCare
        </Link>
      </div>
    );
  }

  // status === "pending" — GDPR-04: no photo without current consent.
  if (consent.isLoading) return <LoadingBlock label="Loading session" />;
  if (!consent.data?.consented) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <PhotoConsentScreen
          onConsented={() =>
            queryClient.invalidateQueries({ queryKey: ["braidcare", "photo-consent"] })
          }
          onDecline={() => router.push("/braidcare")}
        />
      </div>
    );
  }

  const canAnalyse = photoCount > 0;

  async function runAnalysis() {
    setActionError(null);
    try {
      const result = await analyse.mutateAsync();
      if ("status" in result && result.status === "queued") {
        setQueued(true);
      }
      // otherwise the session query refetches and flips to the report
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Couldn't start the analysis. Please try again."
      );
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <Link href="/braidcare" className="text-sm text-teal-deep hover:text-plum">
          ← BraidCare
        </Link>
        <PageHeader title={`Session ${session.session_number}`} />
      </div>

      <BraidcareDisclaimer />
      <PhotoGuidance />
      <PhotoCapture
        sessionId={id}
        initialCount={session.photos_count}
        onCountChange={setPhotoCountOverride}
      />

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <div className="bg-cream/95 sticky bottom-16 rounded-lg border border-mist p-4 backdrop-blur md:bottom-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate">
            {canAnalyse
              ? `${photoCount} photo${photoCount === 1 ? "" : "s"} ready`
              : "Add at least one photo to continue"}
          </p>
          <Button
            size="lg"
            className="sm:!w-auto"
            disabled={!canAnalyse || analyse.isPending}
            onClick={runAnalysis}
          >
            {analyse.isPending ? (
              <>
                <Spinner className="h-4 w-4" /> Starting…
              </>
            ) : (
              "Check my scalp"
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate">
          Photos are used only for this check and are never shared with your braider.
        </p>
      </div>
    </div>
  );
}
