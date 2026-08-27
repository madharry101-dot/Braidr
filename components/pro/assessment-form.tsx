"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api/client";
import { ASSESSMENT_QUESTIONS, type AssessmentAnswers } from "@/lib/types/pro";

export function AssessmentForm({
  initial,
  onSubmit,
  submitLabel = "See my roadmap",
}: {
  initial?: AssessmentAnswers | null;
  onSubmit: (answers: AssessmentAnswers) => Promise<unknown>;
  submitLabel?: string;
}) {
  const [answers, setAnswers] = useState<Partial<AssessmentAnswers>>(initial ?? {});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = ASSESSMENT_QUESTIONS.every((q) => typeof answers[q.key] === "boolean");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!allAnswered) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit(answers as AssessmentAnswers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your answers.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      {ASSESSMENT_QUESTIONS.map((q) => (
        <fieldset key={q.key} className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-plum">{q.label}</legend>
          <div className="flex gap-2">
            {[
              { v: true, label: "Yes" },
              { v: false, label: "No" },
            ].map((opt) => {
              const selected = answers[q.key] === opt.v;
              return (
                <button
                  key={opt.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAnswers((a) => ({ ...a, [q.key]: opt.v }))}
                  className={
                    "min-h-[44px] flex-1 rounded border px-4 text-sm font-medium transition-colors " +
                    (selected
                      ? "border-plum bg-plum text-white"
                      : "border-mist bg-white text-plum hover:border-plum")
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <Button type="submit" disabled={!allAnswered} loading={pending} className="sm:!w-auto">
        {submitLabel}
      </Button>
    </form>
  );
}
