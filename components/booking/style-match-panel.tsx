"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import type { ApiEnvelope } from "@/lib/api/client";

type MatchResult = {
  identified_style: string;
  style_label: string;
  confidence: number;
  matched_braiders: { id: string; display_name: string; avg_rating: number | null }[];
  search_params: { category: string; style_tags: string[] } | null;
};

// PRD FR-MATCH-01 — "upload a photo of a style you like; AI identifies it".
// Uses a raw fetch (not the JSON api client) because this endpoint takes
// multipart/form-data.
export function StyleMatchPanel({
  city,
  onStyleIdentified,
}: {
  city?: string;
  onStyleIdentified: (styleTag: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStatus("loading");
    setErrorMsg(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      if (city) form.append("city", city);
      const res = await fetch("/api/braiders/style-match", { method: "POST", body: form });
      const payload = (await res.json()) as ApiEnvelope<MatchResult>;
      if (!payload.success) {
        setErrorMsg(payload.error.message);
        setStatus("error");
        return;
      }
      setResult(payload.data);
      setStatus("done");
    } catch {
      setErrorMsg("Upload failed. Please try again.");
      setStatus("error");
    }
  }

  const styleTag =
    result?.search_params?.style_tags?.[0] ?? result?.style_label?.toLowerCase() ?? "";

  return (
    <div className="rounded-lg border border-mist bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[48px] w-full items-center justify-between px-4 text-left text-sm font-medium text-plum"
      >
        <span>📸 Not sure what it&rsquo;s called? Match a style from a photo</span>
        <span aria-hidden className="text-slate">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="border-t border-mist px-4 py-4">
          <p className="text-sm text-slate">
            Upload a photo of braids you like — we&rsquo;ll identify the style and filter the
            results.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />

          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={status === "loading"}
            >
              {status === "loading" ? (
                <>
                  <Spinner className="h-4 w-4" /> Analysing…
                </>
              ) : (
                "Choose a photo"
              )}
            </Button>
          </div>

          {status === "error" && errorMsg && (
            <Alert tone="error" className="mt-3">
              {errorMsg}
            </Alert>
          )}

          {status === "done" && result && (
            <div className="mt-3">
              {result.identified_style === "unclear" || result.confidence < 0.5 ? (
                <Alert tone="info">
                  We couldn&rsquo;t confidently identify the style in that photo. Try a clearer,
                  closer shot — or pick a style from the dropdown above.
                </Alert>
              ) : (
                <div className="rounded border border-mist bg-cream p-3">
                  <p className="text-sm text-plum">
                    Looks like <span className="font-semibold">{result.style_label}</span>{" "}
                    <span className="text-slate">
                      ({Math.round(result.confidence * 100)}% confident)
                    </span>
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      if (styleTag) onStyleIdentified(styleTag);
                      setOpen(false);
                    }}
                  >
                    Show {result.style_label} braiders
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
