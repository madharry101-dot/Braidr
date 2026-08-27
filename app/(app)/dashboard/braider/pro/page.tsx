"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/field";
import { LoadingBlock, Spinner } from "@/components/ui/spinner";
import { RequireBraiderProfile } from "@/components/braider/require-profile";
import { AssessmentForm } from "@/components/pro/assessment-form";
import {
  useProProgress,
  useSubmitAssessment,
  useCompleteProStep,
  useProSubscribe,
} from "@/lib/hooks/pro";
import { ApiError } from "@/lib/api/client";
import { PRO_STEPS, type ProProgress } from "@/lib/types/pro";
import type { MyBraiderProfile } from "@/lib/types/braidmatch";

function ProPaywall() {
  const subscribe = useProSubscribe();
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setError(null);
    try {
      const { checkout_url } = await subscribe.mutateAsync();
      window.location.href = checkout_url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start checkout.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Braidr Pro"
        subtitle="Turn braiding into a properly set-up business — and pay less commission."
      />
      <Card className="max-w-lg">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Braidr Pro</CardTitle>
          <span className="text-sm text-slate">£35 / month · first month free</span>
        </div>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-slate">
          <li>A guided 5-step pathway: HMRC, insurance, banking, growth.</li>
          <li>
            Commission drops from <span className="font-medium text-plum">12% to 5%</span> on every
            booking.
          </li>
          <li>Income &amp; tax records, CSV export, and one-tap invoices.</li>
          <li>The Braidr-verified badge on your profile once you finish step 4.</li>
        </ul>
        {error && (
          <Alert tone="error" className="mt-3">
            {error}
          </Alert>
        )}
        <Button className="mt-4 sm:!w-auto" loading={subscribe.isPending} onClick={go}>
          Start free month
        </Button>
      </Card>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-plum">Your progress</span>
        <span className="text-slate">{pct}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-mist">
        <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StepShell({
  n,
  title,
  blurb,
  state,
  children,
}: {
  n: number;
  title: string;
  blurb: string;
  state: "locked" | "active" | "done";
  children?: React.ReactNode;
}) {
  return (
    <Card className={state === "locked" ? "opacity-60" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
                (state === "done" ? "bg-success text-white" : "bg-mist text-slate")
              }
            >
              {state === "done" ? "✓" : n}
            </span>
            <h3 className="font-medium text-plum">{title}</h3>
          </div>
          <p className="mt-1 text-sm text-slate">{blurb}</p>
        </div>
        {state === "locked" && <Badge tone="neutral">Locked</Badge>}
        {state === "done" && <Badge tone="braidcare">Done</Badge>}
      </div>
      {state === "active" && children && <div className="mt-4">{children}</div>}
    </Card>
  );
}

function Step2Form() {
  const complete = useCompleteProStep();
  const [utr, setUtr] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await complete.mutateAsync({ step: 2, utr });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your UTR.");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-slate">
        Not registered yet?{" "}
        <a
          href="https://www.gov.uk/register-for-self-assessment"
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-deep underline hover:text-plum"
        >
          Register for Self Assessment on GOV.UK
        </a>
        , then come back with your UTR.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <Input
        label="Your UTR (10 digits)"
        inputMode="numeric"
        maxLength={10}
        placeholder="1234567890"
        value={utr}
        onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))}
      />
      <Button
        type="submit"
        size="sm"
        className="sm:!w-auto"
        loading={complete.isPending}
        disabled={utr.length !== 10}
      >
        Save &amp; complete step
      </Button>
    </form>
  );
}

function Step3Form() {
  const complete = useCompleteProStep();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setFileName(file.name);
    try {
      await complete.mutateAsync({ step: 3, file });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setFileName(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <label className="flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded border border-dashed border-mist bg-white px-4 text-sm text-teal-deep hover:border-plum sm:w-auto">
        {complete.isPending ? (
          <>
            <Spinner className="mr-2 h-4 w-4" /> Uploading…
          </>
        ) : (
          (fileName ?? "Upload proof of insurance (PDF, JPG or PNG)")
        )}
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
    </div>
  );
}

function Step4Form() {
  const complete = useCompleteProStep();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <label className="flex items-start gap-2 text-sm text-plum">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I keep my braiding income in a separate bank account (a personal second account is fine).
      </label>
      <Button
        size="sm"
        className="sm:!w-auto"
        disabled={!confirmed}
        loading={complete.isPending}
        onClick={async () => {
          setError(null);
          try {
            await complete.mutateAsync({ step: 4 });
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "Couldn't complete this step.");
          }
        }}
      >
        Complete &amp; claim badge
      </Button>
    </div>
  );
}

function Step5Form() {
  const complete = useCompleteProStep();
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-slate">
        <li>Set your prices from your real costs and time — not just what others charge.</li>
        <li>Keep a simple portfolio and ask happy clients for a review after each appointment.</li>
        <li>Consider a recognised braiding or scalp-care CPD course each year.</li>
      </ul>
      <Button
        size="sm"
        className="sm:!w-auto"
        loading={complete.isPending}
        onClick={() => complete.mutateAsync({ step: 5 }).catch(() => {})}
      >
        Mark as done
      </Button>
    </div>
  );
}

function stepState(progress: ProProgress, step: 2 | 3 | 4 | 5): "locked" | "active" | "done" {
  const done = {
    2: progress.step2_hmrc_completed,
    3: progress.step3_insurance_completed,
    4: progress.step4_banking_completed,
    5: progress.step5_accessed,
  }[step];
  if (done) return "done";
  const prereq = {
    2: progress.assessment_completed,
    3: progress.step2_hmrc_completed,
    4: progress.step3_insurance_completed,
    5: progress.step4_banking_completed,
  }[step];
  return prereq ? "active" : "locked";
}

function Pathway() {
  const { data, isLoading, isError } = useProProgress();
  const submitAssessment = useSubmitAssessment();
  const [retaking, setRetaking] = useState(false);

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) return <Alert tone="error">Couldn&rsquo;t load your Pro pathway.</Alert>;

  if (!data.started || !data.progress) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Braidr Pro" subtitle="Start with a 2-minute readiness check." />
        <Card>
          <CardTitle className="text-base">Readiness assessment</CardTitle>
          <p className="mt-1 text-sm text-slate">
            Five quick questions. Your answers shape your roadmap — they don&rsquo;t complete any
            steps for you.
          </p>
          <div className="mt-4">
            <AssessmentForm onSubmit={(a) => submitAssessment.mutateAsync(a)} />
          </div>
        </Card>
      </div>
    );
  }

  const p = data.progress;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Braidr Pro"
        subtitle="Your self-employment pathway."
        action={
          <Link
            href="/dashboard/braider/pro/income"
            className="text-sm font-medium text-teal-deep hover:text-plum"
          >
            Income &amp; invoices →
          </Link>
        }
      />

      <Card>
        <ProgressBar pct={p.overall_progress_pct} />
        {p.step4_badge_awarded && (
          <p className="mt-3 flex items-center gap-2 text-sm text-success">
            <Badge tone="verified">✓ Braidr-verified</Badge>
            Your badge is now shown on your profile.
          </p>
        )}
      </Card>

      {/* Step 1 */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-xs font-semibold text-white"
              >
                ✓
              </span>
              <h3 className="font-medium text-plum">Readiness assessment</h3>
            </div>
            <p className="mt-1 text-sm text-slate">
              Completed. Retake it any time your situation changes.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="sm:!w-auto"
            onClick={() => setRetaking((v) => !v)}
          >
            {retaking ? "Cancel" : "Retake"}
          </Button>
        </div>
        {retaking && (
          <div className="mt-4">
            <AssessmentForm
              initial={p.assessment_results}
              submitLabel="Save answers"
              onSubmit={async (a) => {
                await submitAssessment.mutateAsync(a);
                setRetaking(false);
              }}
            />
          </div>
        )}
      </Card>

      {/* Steps 2-5 */}
      {PRO_STEPS.map((s) => {
        const state = stepState(p, s.step);
        const blurb =
          s.step === 2 && p.utr_masked && state === "done"
            ? `UTR on file: ${p.utr_masked}`
            : s.blurb;
        return (
          <StepShell key={s.step} n={s.step} title={s.title} blurb={blurb} state={state}>
            {s.step === 2 && <Step2Form />}
            {s.step === 3 && <Step3Form />}
            {s.step === 4 && <Step4Form />}
            {s.step === 5 && <Step5Form />}
          </StepShell>
        );
      })}

      <p className="text-xs text-slate">
        HMRC Self Assessment deadlines are 31 January and 31 July. Braidr sends reminders 60, 30 and
        7 days before each.
      </p>
    </div>
  );
}

function ProInner({ profile }: { profile: MyBraiderProfile }) {
  const params = useSearchParams();
  const qc = useQueryClient();
  const justSubscribed = params.get("subscribed") === "true";

  useEffect(() => {
    if (!justSubscribed || profile.braidr_pro_subscribed) return;
    let n = 0;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["braider", "me"] });
      if (++n >= 5) clearInterval(t);
    }, 2000);
    return () => clearInterval(t);
  }, [justSubscribed, profile.braidr_pro_subscribed, qc]);

  if (!profile.braidr_pro_subscribed) {
    return (
      <>
        {justSubscribed && (
          <Alert tone="info" className="mb-4">
            Finishing your subscription — this can take a minute. Refresh if it doesn&rsquo;t
            update.
          </Alert>
        )}
        <ProPaywall />
      </>
    );
  }
  return <Pathway />;
}

export default function BraiderProPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <RequireBraiderProfile>{(me) => <ProInner profile={me.profile} />}</RequireBraiderProfile>
    </Suspense>
  );
}
