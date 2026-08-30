"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { TextureIcon } from "@/components/hair/texture-icon";
import { HAIR_TEXTURES, TEXTURE_META, type HairTexture } from "@/lib/hair/textures";
import { useSetTextureSpecialisations } from "@/lib/hooks/braider-dashboard";
import { ApiError } from "@/lib/api/client";
import type { TextureSpec } from "@/lib/types/braidmatch";

// Braider onboarding — "Which textures do you specialise in?". Multi-select.
// Each option expands inline on select to show the swatch + description —
// the education is delivered at the point of selection, not as separate
// training content.
//
// Verification is derived, never declared: a specialisation shows "Pending
// verification" until the braider has tagged at least one portfolio photo
// with that texture (DB trigger). Unverified ones are not shown to clients.

export function TextureSpecialisations({
  specs,
  taggedTextures,
}: {
  specs: TextureSpec[];
  /** Textures that currently have >= 1 tagged portfolio photo. */
  taggedTextures: HairTexture[];
}) {
  const set = useSetTextureSpecialisations();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<HairTexture | null>(null);

  const selected = new Set(specs.map((s) => s.texture));
  const verified = new Set(specs.filter((s) => s.is_verified).map((s) => s.texture));
  const tagged = new Set(taggedTextures);

  async function toggle(texture: HairTexture) {
    setError(null);
    const next = new Set(selected);
    if (next.has(texture)) next.delete(texture);
    else {
      next.add(texture);
      setExpanded(texture);
    }
    try {
      await set.mutateAsync([...next]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't save your specialisations. Try again."
      );
    }
  }

  const unverifiedCount = specs.length - verified.size;

  return (
    <div>
      <p className="text-sm text-slate">
        Select all that apply. Add one portfolio photo per texture to get verified — only verified
        specialisations are shown to clients.
      </p>

      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {HAIR_TEXTURES.map((t) => {
          const isSelected = selected.has(t);
          const isVerified = verified.has(t);
          const isOpen = expanded === t;
          return (
            <div
              key={t}
              className={cn(
                "rounded-lg border-2 transition-colors",
                isSelected ? "bg-teal/5 border-teal" : "border-mist bg-white"
              )}
            >
              <button
                type="button"
                aria-pressed={isSelected}
                aria-expanded={isOpen}
                disabled={set.isPending}
                onClick={() => {
                  if (isSelected && !isOpen) setExpanded(t);
                  else toggle(t);
                }}
                className="flex w-full items-center gap-3 p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-xs",
                    isSelected ? "bg-teal text-white" : "border border-mist text-transparent"
                  )}
                >
                  ✓
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                    isSelected ? "bg-teal/15 text-teal-deep" : "bg-mist text-slate"
                  )}
                >
                  <TextureIcon texture={t} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-plum">
                  {TEXTURE_META[t].label}
                </span>
                {isSelected &&
                  (isVerified ? (
                    <Badge tone="verified">✓ Verified</Badge>
                  ) : (
                    <Badge tone="warning">Pending verification</Badge>
                  ))}
              </button>

              {(isOpen || isSelected) && (
                <div className="border-t border-dashed border-mist px-3 pb-3 pt-3">
                  <p className="text-sm text-slate">{TEXTURE_META[t].braiderBlurb}</p>
                  {isSelected && !tagged.has(t) && (
                    <p className="mt-2 text-sm font-medium text-gold-deep">
                      ↑ Tag a portfolio photo below as {TEXTURE_META[t].label} to verify this
                      specialisation.
                    </p>
                  )}
                  {isSelected && (
                    <button
                      type="button"
                      onClick={() => toggle(t)}
                      disabled={set.isPending}
                      className="mt-2 text-sm text-slate underline hover:text-plum disabled:opacity-60"
                    >
                      Remove this specialisation
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {unverifiedCount > 0 && (
        <p className="mt-3 text-sm text-slate">
          {unverifiedCount} specialisation{unverifiedCount === 1 ? "" : "s"} awaiting a tagged
          portfolio photo. Clients won&rsquo;t see {unverifiedCount === 1 ? "it" : "them"} until
          then.
        </p>
      )}
    </div>
  );
}
