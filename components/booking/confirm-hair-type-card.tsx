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
  HAIR_TYPE_LABEL,
  TEXTURE_META,
  isHairTexture,
  type HairTexture,
  type HairTypeValue,
} from "@/lib/hair/textures";

// Part 1 — braider post-appointment step. Single tap to confirm what the
// client reported, or override it. Always skippable: this card never gates
// "Mark as completed", and dismissing it does nothing destructive.

export function ConfirmHairTypeCard({
  bookingId,
  clientName,
  clientHairType,
  alreadyConfirmed,
}: {
  bookingId: string;
  clientName: string;
  clientHairType: HairTypeValue | null;
  alreadyConfirmed: boolean;
}) {
  const confirm = useConfirmClientHairType(bookingId);
  const [dismissed, setDismissed] = useState(false);
  const [override, setOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (dismissed) return null;

  const selfReported = isHairTexture(clientHairType) ? clientHairType : null;

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
    return <Alert tone="success">Thanks — {clientName}&rsquo;s hair type has been updated.</Alert>;
  }

  return (
    <Card>
      <CardTitle className="text-lg">Confirm this client&rsquo;s hair type</CardTitle>
      <p className="mt-1 text-sm text-slate">
        Optional. What you saw in the chair is more useful than a self-assessment — it helps us
        match {clientName} well next time. Skip this if you&rsquo;d rather not.
      </p>

      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}

      {alreadyConfirmed && !override && (
        <p className="mt-3 text-sm text-slate">
          A braider has already confirmed this as{" "}
          <span className="font-medium text-plum">
            {clientHairType ? HAIR_TYPE_LABEL[clientHairType] : "not set"}
          </span>
          .
        </p>
      )}

      {!override ? (
        <div className="mt-4 flex flex-col gap-3">
          {selfReported ? (
            <>
              <p className="text-sm text-plum">
                {clientName} says their hair is{" "}
                <span className="font-medium">{TEXTURE_META[selfReported].label}</span> —{" "}
                {TEXTURE_META[selfReported].desc.toLowerCase()}.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="sm:!w-auto"
                  loading={confirm.isPending}
                  onClick={() => submit(selfReported)}
                >
                  Confirm {TEXTURE_META[selfReported].label}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="sm:!w-auto"
                  onClick={() => setOverride(true)}
                >
                  It&rsquo;s something else
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-plum">
                {clientName} hasn&rsquo;t set a hair type. You can add one from what you saw.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="sm:!w-auto"
                onClick={() => setOverride(true)}
              >
                Set their hair type
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="self-start text-sm text-slate underline hover:text-plum"
          >
            Skip
          </button>
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
                aria-checked={false}
                disabled={confirm.isPending}
                onClick={() => submit(t)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border-2 border-mist bg-white p-3 text-left",
                  "hover:border-teal/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal",
                  "disabled:opacity-60"
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
            onClick={() => setOverride(false)}
            className="mt-3 text-sm text-slate underline hover:text-plum"
          >
            Back
          </button>
        </div>
      )}
    </Card>
  );
}
