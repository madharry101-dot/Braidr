"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { TextureIcon } from "@/components/hair/texture-icon";
import { useConfirmClientHairType } from "@/lib/hooks/braidmatch";
import { ApiError } from "@/lib/api/client";
import {
  HAIR_TEXTURES,
  TEXTURE_META,
  isHairTexture,
  type HairTexture,
  type HairTypeValue,
} from "@/lib/hair/textures";

// Part 1 — braider post-appointment step. The braider records the texture
// they actually worked with, so we can match this client better next time.
//
// The braider does NOT see the client's own self-assessment (that stays on
// the client's side — see the braider_client_profiles view). So `clientHairType`
// here is either a value a braider confirmed on a previous appointment, or
// null. Always skippable: this never gates "Mark as completed".

export function ConfirmHairTypeCard({
  bookingId,
  clientName,
  clientHairType,
}: {
  bookingId: string;
  clientName: string;
  clientHairType: HairTypeValue | null;
}) {
  const confirm = useConfirmClientHairType(bookingId);
  const [dismissed, setDismissed] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (dismissed) return null;

  const recorded = isHairTexture(clientHairType) ? clientHairType : null;

  async function submit(texture: HairTexture) {
    setError(null);
    try {
      await confirm.mutateAsync(texture);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save. Please try again.");
    }
  }

  if (done) {
    return <Alert tone="success">Thanks — {clientName}&rsquo;s hair type has been recorded.</Alert>;
  }

  return (
    <Card>
      <CardTitle className="text-lg">
        {recorded ? "Update this client’s hair type" : "Record this client’s hair type"}
      </CardTitle>
      <p className="mt-1 text-sm text-slate">
        Optional. Noting the texture you worked with helps us match {clientName} well next time.
        Skip this if you&rsquo;d rather not.
      </p>

      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}

      {!picking ? (
        <div className="mt-4 flex flex-col gap-3">
          {recorded ? (
            <p className="text-sm text-plum">
              Currently recorded as{" "}
              <span className="font-medium">{TEXTURE_META[recorded].label}</span>, confirmed after
              an earlier appointment.
            </p>
          ) : (
            <p className="text-sm text-plum">Not recorded yet.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="sm:!w-auto"
              onClick={() => setPicking(true)}
            >
              {recorded ? "Change it" : "Record hair type"}
            </Button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="self-center text-sm text-slate underline hover:text-plum"
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div
            role="radiogroup"
            aria-label="Client hair type"
            className="grid gap-2 xs:grid-cols-2"
          >
            {HAIR_TEXTURES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={recorded === t}
                disabled={confirm.isPending}
                onClick={() => submit(t)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border-2 p-3 text-left",
                  "hover:border-teal/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal",
                  "disabled:opacity-60",
                  recorded === t ? "bg-teal/5 border-teal" : "border-mist bg-white"
                )}
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-mist text-slate"
                >
                  <TextureIcon texture={t} className="h-6 w-6" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-plum">
                    {TEXTURE_META[t].label}
                  </span>
                  <span className="block text-xs text-slate">{TEXTURE_META[t].desc}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="mt-3 text-sm text-slate underline hover:text-plum"
          >
            Back
          </button>
        </div>
      )}
    </Card>
  );
}
