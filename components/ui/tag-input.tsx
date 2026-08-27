"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

// Free-text tag entry (styles / specialisations). Type and press Enter or
// comma to add; Backspace on an empty field removes the last tag.
export function TagInput({
  label,
  value,
  onChange,
  placeholder = "Type a style and press Enter",
  suggestions = [],
  max = 20,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: readonly string[];
  max?: number;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
    setDraft("");
  }

  const remaining = suggestions.filter((s) => !value.includes(s)).slice(0, 8);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-plum">{label}</span>
      <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded border border-mist bg-white p-2">
        {value.map((tag) => (
          <Badge key={tag} tone="neutral">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="ml-0.5 text-slate hover:text-plum"
            >
              ×
            </button>
          </Badge>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="placeholder:text-slate/60 min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-plum outline-none"
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-mist px-2.5 py-0.5 text-xs text-slate hover:border-plum hover:text-plum"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
