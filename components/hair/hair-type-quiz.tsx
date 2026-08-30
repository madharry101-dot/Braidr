"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextureIcon } from "@/components/hair/texture-icon";
import {
  HAIR_QUIZ,
  TEXTURE_META,
  resolveQuiz,
  type HairTexture,
  type QuizAnswer,
} from "@/lib/hair/textures";

// "Not sure — help me figure it out": a 2-question guided flow that maps to
// exactly the same four categories as the direct selector. The result is
// stored the same way as a direct pick — there is no separate data path.

export function HairTypeQuiz({
  onResolved,
  onClose,
}: {
  onResolved: (texture: HairTexture) => void;
  onClose: () => void;
}) {
  const [q1, setQ1] = useState<QuizAnswer | null>(null);
  const [q2, setQ2] = useState<QuizAnswer | null>(null);

  const step: "q1" | "q2" | "result" = q1 === null ? "q1" : q2 === null ? "q2" : "result";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const result = step === "result" ? resolveQuiz(q1!, q2!) : null;

  return (
    <div
      className="bg-plum/50 fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Help me figure out my hair type"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-surface p-6 shadow-card">
        {step !== "result" ? (
          <>
            <p className="text-xs font-medium text-slate">
              Question {step === "q1" ? "1" : "2"} of 2
            </p>
            <h2 className="mt-2 font-display text-lg text-plum">
              {step === "q1" ? HAIR_QUIZ.q1.prompt : HAIR_QUIZ.q2.prompt}
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              {(step === "q1" ? HAIR_QUIZ.q1.options : HAIR_QUIZ.q2.options).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => (step === "q1" ? setQ1(opt.value) : setQ2(opt.value))}
                  className="flex items-center gap-3 rounded-lg border border-mist bg-white px-4 py-3 text-left text-sm text-plum hover:border-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                >
                  <span aria-hidden className="text-teal">
                    <TextureIcon texture={opt.value} className="h-5 w-5" />
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              {step === "q2" ? (
                <button
                  type="button"
                  onClick={() => setQ1(null)}
                  className="text-sm text-teal-deep hover:text-plum"
                >
                  ← Back
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-slate underline hover:text-plum"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <span
              aria-hidden
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-mist text-teal"
            >
              <TextureIcon texture={result!} className="h-9 w-9" />
            </span>
            <h2 className="mt-3 font-display text-xl text-plum">
              Looks like: {TEXTURE_META[result!].label}
            </h2>
            <p className="mt-1 text-sm text-slate">
              {TEXTURE_META[result!].desc}. You can change this any time in Settings.
            </p>
            <Button
              className="mt-5"
              onClick={() => {
                onResolved(result!);
                onClose();
              }}
            >
              Use this hair type
            </Button>
            <button
              type="button"
              onClick={() => {
                setQ1(null);
                setQ2(null);
              }}
              className="mt-3 block w-full text-sm text-slate underline hover:text-plum"
            >
              Start over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
