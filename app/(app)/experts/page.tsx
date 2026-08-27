"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { ExpertCard } from "@/components/expert/expert-card";
import { useExperts } from "@/lib/hooks/expert";
import { SPECIALISATION_OPTIONS } from "@/lib/types/expert";

function Directory() {
  const router = useRouter();
  const params = useSearchParams();
  const referSessionId = params.get("refer") ?? undefined;
  const spec = params.get("spec") ?? "";

  const { data: experts, isLoading, isError } = useExperts(spec || undefined);

  function setSpec(v: string) {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("spec", v);
    else next.delete("spec");
    router.replace(`/experts?${next.toString()}`, { scroll: false });
  }

  return (
    <div>
      <PageHeader
        title="Scalp health specialists"
        subtitle="Verified dermatologists and trichologists who work with braiding clients."
      />

      {referSessionId && (
        <Alert tone="info" className="mb-4">
          Choose a specialist to refer yourself to. They can see the areas your BraidCare check
          flagged if you consent.
        </Alert>
      )}

      <div className="max-w-xs">
        <Select label="Specialisation" value={spec} onChange={(e) => setSpec(e.target.value)}>
          <option value="">All specialisations</option>
          {SPECIALISATION_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-6">
        {isLoading && <LoadingBlock label="Loading specialists" />}
        {isError && <Alert tone="error">Couldn&rsquo;t load the directory.</Alert>}
        {experts && experts.length === 0 && (
          <div className="rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
            <p className="font-medium text-plum">No specialists listed yet</p>
            <p className="mt-1 text-sm text-slate">
              Braidr&rsquo;s expert network is growing. Check back soon, or ask your braider.
            </p>
          </div>
        )}
        {experts && experts.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {experts.map((e) => (
              <ExpertCard key={e.id} expert={e} referSessionId={referSessionId} />
            ))}
          </div>
        )}
      </div>

      <p className="mt-8 text-xs text-slate">
        Are you a scalp health professional?{" "}
        <Link href="/register" className="underline hover:text-plum">
          Join the network
        </Link>
        .
      </p>
    </div>
  );
}

export default function ExpertsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Directory />
    </Suspense>
  );
}
