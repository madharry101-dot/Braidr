"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api/client";
import { SERVICE_CATEGORIES, type Service } from "@/lib/types/braidmatch";
import type { ServiceInput } from "@/lib/hooks/braider-dashboard";

const toPence = (pounds: string) => Math.round(parseFloat(pounds) * 100);
const toPounds = (pence: number) => (pence / 100).toString();

export function ServiceForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: Service;
  onSubmit: (input: ServiceInput) => Promise<unknown>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "braids");
  const [priceFrom, setPriceFrom] = useState(initial ? toPounds(initial.price_from) : "");
  const [priceTo, setPriceTo] = useState(
    initial?.price_to != null ? toPounds(initial.price_to) : ""
  );
  const [durationMins, setDurationMins] = useState(initial?.duration_mins?.toString() ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const from = toPence(priceFrom);
    const to = priceTo ? toPence(priceTo) : undefined;
    const mins = Number(durationMins);

    if (!name.trim()) return setError("Give the service a name.");
    if (!Number.isFinite(from) || from <= 0) return setError("Enter a valid starting price.");
    if (to !== undefined && to < from)
      return setError("The higher price can’t be less than the starting price.");
    if (!Number.isInteger(mins) || mins < 15 || mins > 720)
      return setError("Duration must be between 15 and 720 minutes.");

    setPending(true);
    try {
      await onSubmit({
        name: name.trim(),
        category: category as Service["category"],
        price_from: from,
        price_to: to,
        duration_mins: mins,
        description: description.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the service.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <Input
        label="Service name"
        placeholder="e.g. Knotless Braids (medium)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Service["category"])}
        >
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Input
          label="Duration (minutes)"
          type="number"
          min={15}
          max={720}
          step={15}
          placeholder="180"
          value={durationMins}
          onChange={(e) => setDurationMins(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Price from (£)"
          type="number"
          min={0}
          step="0.01"
          placeholder="80"
          value={priceFrom}
          onChange={(e) => setPriceFrom(e.target.value)}
          required
        />
        <Input
          label="Price up to (£, optional)"
          type="number"
          min={0}
          step="0.01"
          placeholder="120"
          hint="Leave blank for a fixed price"
          value={priceTo}
          onChange={(e) => setPriceTo(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="svc-desc" className="text-sm font-medium text-plum">
          Description (optional)
        </label>
        <textarea
          id="svc-desc"
          rows={2}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="placeholder:text-slate/60 w-full rounded border border-mist bg-white px-3 py-2 text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending} className="sm:!w-auto">
          {submitLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          className="sm:!w-auto"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
