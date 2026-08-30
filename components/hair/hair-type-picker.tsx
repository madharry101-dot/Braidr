"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { TextureIcon } from "@/components/hair/texture-icon";
import { HairTypeQuiz } from "@/components/hair/hair-type-quiz";
import {
  HAIR_TEXTURES,
  HAIR_TYPE_LABEL,
  TEXTURE_META,
  type HairTypeValue,
} from "@/lib/hair/textures";

export type HairTypeConfirmation = {
  by_name: string;
  at: string; // ISO date
  value: HairTypeValue | null;
};

export function HairTypePicker({
  value,
  onChange,
  confirmation,
}: {
  value: HairTypeValue | null;
  onChange: (next: HairTypeValue | null) => void;
  confirmation?: HairTypeConfirmation | null;
}) {
  const [quizOpen, setQuizOpen] = useState(false);

  return (
    <div>
      <p className="text-sm text-slate">
        This helps us match you with braiders experienced in your texture, and helps BraidCare give
        more relevant guidance.
      </p>

      <div
        role="radiogroup"
        aria-label="Hair type"
        className="mt-3 grid grid-cols-1 gap-2 xs:grid-cols-2"
      >
        {HAIR_TEXTURES.map((t) => {
          const selected = value === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(t)}
              className={cn(
                "flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal",
                selected ? "bg-teal/5 border-teal" : "hover:border-teal/40 border-mist bg-white"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg",
                  selected ? "bg-teal/15 text-teal-deep" : "bg-mist text-slate"
                )}
              >
                <TextureIcon texture={t} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-plum">{TEXTURE_META[t].label}</span>
                <span className="block text-xs text-slate">{TEXTURE_META[t].desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => onChange(value === "prefer_not_to_say" ? null : "prefer_not_to_say")}
          className={cn(
            "text-sm underline hover:text-plum",
            value === "prefer_not_to_say" ? "font-medium text-plum" : "text-slate"
          )}
        >
          {HAIR_TYPE_LABEL.prefer_not_to_say}
        </button>
        <button
          type="button"
          onClick={() => setQuizOpen(true)}
          className="text-sm font-medium text-teal-deep hover:text-plum"
        >
          Not sure? Help me figure it out
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-sm text-slate underline hover:text-plum"
          >
            Clear
          </button>
        )}
      </div>

      {confirmation && (
        <div className="border-success/30 mt-4 flex items-start gap-2.5 rounded-lg border bg-success-bg px-3 py-2.5">
          <span
            aria-hidden
            className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-success text-xs text-white"
          >
            ✓
          </span>
          <p className="text-sm text-success">
            <b className="font-semibold">Confirmed by {confirmation.by_name}</b>{" "}
            {confirmation.value ? `— ${HAIR_TYPE_LABEL[confirmation.value]}` : ""} on{" "}
            {new Date(confirmation.at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            . A braider updated this after an appointment.
          </p>
        </div>
      )}

      {quizOpen && (
        <HairTypeQuiz
          onResolved={(texture) => onChange(texture)}
          onClose={() => setQuizOpen(false)}
        />
      )}
    </div>
  );
}
