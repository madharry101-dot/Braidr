"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/field";
import { LoadingBlock } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";
import { BraiderCard } from "@/components/booking/braider-card";
import { StyleMatchPanel } from "@/components/booking/style-match-panel";
import { useBraiderSearch, type BraiderFilters } from "@/lib/hooks/braidmatch";
import { STYLE_OPTIONS, UK_CITIES } from "@/lib/types/braidmatch";

const PRICE_BANDS = [
  { label: "Any price", value: "" },
  { label: "Up to £50", value: "5000" },
  { label: "Up to £100", value: "10000" },
  { label: "Up to £150", value: "15000" },
  { label: "Up to £200", value: "20000" },
];

function BraiderSearch() {
  const router = useRouter();
  const params = useSearchParams();

  const filters: BraiderFilters = {
    city: params.get("city") || undefined,
    style: params.get("style") || undefined,
    price_max_pence: params.get("price_max_pence")
      ? Number(params.get("price_max_pence"))
      : undefined,
    braidcare_only: params.get("braidcare_only") === "true",
    verified_only: params.get("verified_only") === "true",
  };

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`/braiders?${next.toString()}`, { scroll: false });
    },
    [params, router]
  );

  const { data: braiders, isLoading, isError, error } = useBraiderSearch(filters);

  return (
    <div>
      <PageHeader
        title="Find a braider"
        subtitle="Verified braiders across the UK. Filter by location, style and price."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Location"
          value={filters.city ?? ""}
          onChange={(e) => setParam("city", e.target.value)}
        >
          <option value="">Anywhere</option>
          {UK_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select
          label="Style"
          value={filters.style ?? ""}
          onChange={(e) => setParam("style", e.target.value)}
        >
          <option value="">Any style</option>
          {STYLE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          label="Budget"
          value={filters.price_max_pence ? String(filters.price_max_pence) : ""}
          onChange={(e) => setParam("price_max_pence", e.target.value)}
        >
          {PRICE_BANDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Select>
        <div className="flex flex-col justify-center gap-2 pt-1">
          <label className="flex min-h-[22px] items-center gap-2 text-sm text-plum">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={filters.verified_only ?? false}
              onChange={(e) => setParam("verified_only", e.target.checked ? "true" : "")}
            />
            Verified only
          </label>
          <label className="flex min-h-[22px] items-center gap-2 text-sm text-plum">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={filters.braidcare_only ?? false}
              onChange={(e) => setParam("braidcare_only", e.target.checked ? "true" : "")}
            />
            Offers BraidCare
          </label>
        </div>
      </div>

      <div className="mt-6">
        <StyleMatchPanel
          city={filters.city}
          onStyleIdentified={(style) => setParam("style", style)}
        />
      </div>

      <div className="mt-8">
        {isLoading && <LoadingBlock label="Searching braiders" />}
        {isError && (
          <Alert tone="error">{error?.message ?? "Couldn't load braiders. Try again."}</Alert>
        )}
        {braiders && braiders.length === 0 && (
          <div className="rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
            <p className="font-medium text-plum">No braiders match those filters</p>
            <p className="mt-1 text-sm text-slate">Try widening your search.</p>
          </div>
        )}
        {braiders && braiders.length > 0 && (
          <>
            <p className="mb-4 text-sm text-slate">
              {braiders.length} braider{braiders.length === 1 ? "" : "s"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {braiders.map((b) => (
                <BraiderCard key={b.id} braider={b} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BraidersPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <BraiderSearch />
    </Suspense>
  );
}
