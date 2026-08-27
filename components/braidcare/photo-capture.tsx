"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import type { ApiEnvelope } from "@/lib/api/client";

const MAX_PHOTOS = 6;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

type LocalPhoto = { file: File; url: string };

export function PhotoCapture({
  sessionId,
  initialCount,
  onCountChange,
}: {
  sessionId: string;
  initialCount: number;
  onCountChange: (count: number) => void;
}) {
  // Server-side count (source of truth); local previews for what this
  // browser session uploaded. A reload loses previews but not the count.
  const [count, setCount] = useState(initialCount);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => photos.forEach((p) => URL.revokeObjectURL(p.url));
  }, [photos]);

  function report(next: number) {
    setCount(next);
    onCountChange(next);
  }

  async function upload(files: File[]) {
    setError(null);
    const valid = files.filter((f) => ALLOWED.includes(f.type) && f.size <= 5 * 1024 * 1024);
    if (valid.length !== files.length) {
      setError("Photos must be JPEG, PNG or WEBP and 5MB or smaller.");
    }
    if (valid.length === 0) return;
    if (count + valid.length > MAX_PHOTOS) {
      setError(`A session can have at most ${MAX_PHOTOS} photos.`);
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      valid.forEach((f) => form.append("photos", f));
      const res = await fetch(`/api/braidcare/sessions/${sessionId}/photos`, {
        method: "POST",
        body: form,
      });
      const payload = (await res.json()) as ApiEnvelope<{ photos_count: number }>;
      if (!payload.success) {
        setError(payload.error.message);
        return;
      }
      setPhotos((prev) => [
        ...prev,
        ...valid.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ]);
      report(payload.data.photos_count);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(index: number) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/braidcare/sessions/${sessionId}/photos/${index}`, {
        method: "DELETE",
      });
      const payload = (await res.json()) as ApiEnvelope<{ photos_count: number }>;
      if (!payload.success) {
        setError(payload.error.message);
        return;
      }
      setPhotos((prev) => prev.filter((_, i) => i !== index));
      report(payload.data.photos_count);
    } catch {
      setError("Couldn't remove that photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-mist bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-plum">Photos</h2>
        <span className="text-sm text-slate">
          {count}/{MAX_PHOTOS}
        </span>
      </div>

      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}

      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p, i) => (
            <div key={p.url} className="relative aspect-square overflow-hidden rounded bg-mist">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`Scalp photo ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={busy}
                aria-label={`Remove photo ${i + 1}`}
                className="bg-plum/80 absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && count > 0 && (
        <p className="mt-3 text-sm text-slate">
          {count} photo{count === 1 ? "" : "s"} uploaded.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) upload(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-4 sm:!w-auto"
        disabled={busy || count >= MAX_PHOTOS}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <>
            <Spinner className="h-4 w-4" /> Working…
          </>
        ) : count === 0 ? (
          "Add photos"
        ) : (
          "Add more"
        )}
      </Button>
    </div>
  );
}
