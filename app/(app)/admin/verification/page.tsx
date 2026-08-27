"use client";

import { useState } from "react";
import Image from "next/image";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock } from "@/components/ui/spinner";
import {
  usePendingBraiders,
  usePendingExperts,
  useVerifyBraider,
  useVerifyExpert,
  useExpertCredentialUrl,
} from "@/lib/hooks/admin";
import { publicStorageUrl } from "@/lib/storage";
import { formatDate, formatMoney } from "@/lib/format";
import type { PendingBraider, PendingExpert } from "@/lib/types/admin";

function ReviewActions({
  onDecision,
  pending,
}: {
  onDecision: (approve: boolean, note?: string) => void;
  pending: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  if (rejecting) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          rows={2}
          placeholder="Reason (shown to the applicant)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded border border-mist bg-white px-3 py-2 text-sm text-plum"
        />
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            className="sm:!w-auto"
            loading={pending}
            disabled={!note.trim()}
            onClick={() => onDecision(false, note.trim())}
          >
            Confirm rejection
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="sm:!w-auto"
            onClick={() => setRejecting(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" className="sm:!w-auto" loading={pending} onClick={() => onDecision(true)}>
        Approve
      </Button>
      <Button variant="ghost" size="sm" className="sm:!w-auto" onClick={() => setRejecting(true)}>
        Reject
      </Button>
    </div>
  );
}

function BraiderReview({ braider }: { braider: PendingBraider }) {
  const verify = useVerifyBraider();
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-plum">{braider.name}</h3>
          <p className="text-sm text-slate">
            {braider.area ? `${braider.area}, ` : ""}
            {braider.city}
            {braider.years_experience != null && ` · ${braider.years_experience} yrs`}
          </p>
        </div>
        <span className="text-xs text-slate">{formatDate(braider.created_at)}</span>
      </div>
      {braider.bio && <p className="text-sm text-slate">{braider.bio}</p>}
      {braider.specialisations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {braider.specialisations.map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
        </div>
      )}
      {braider.portfolio_photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {braider.portfolio_photos.slice(0, 4).map((p) => (
            <div key={p} className="relative aspect-square overflow-hidden rounded bg-mist">
              <Image
                src={publicStorageUrl("portfolio-photos", p)}
                alt="portfolio"
                fill
                sizes="120px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
      <ReviewActions
        pending={verify.isPending}
        onDecision={(approve, note) => verify.mutate({ id: braider.id, approve, note })}
      />
    </Card>
  );
}

function ExpertReview({ expert }: { expert: PendingExpert }) {
  const verify = useVerifyExpert();
  const credUrl = useExpertCredentialUrl();

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-plum">{expert.name}</h3>
          <p className="text-sm text-slate">{expert.credentials}</p>
          <p className="text-sm text-slate">
            {expert.clinic_name ? `${expert.clinic_name}, ` : ""}
            {expert.city}
            {expert.consultation_fee_pence != null &&
              ` · from ${formatMoney(expert.consultation_fee_pence)}`}
          </p>
        </div>
        <span className="text-xs text-slate">{formatDate(expert.created_at)}</span>
      </div>
      {expert.specialisation.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {expert.specialisation.map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
        </div>
      )}
      <div>
        <Button
          size="sm"
          variant="secondary"
          className="sm:!w-auto"
          loading={credUrl.isPending}
          onClick={async () => {
            const res = await credUrl.mutateAsync(expert.id).catch(() => null);
            if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
          }}
        >
          View credential document
        </Button>
      </div>
      <ReviewActions
        pending={verify.isPending}
        onDecision={(approve, note) => verify.mutate({ id: expert.id, approve, note })}
      />
    </Card>
  );
}

export default function AdminVerificationPage() {
  const { data: braiders, isLoading: bl } = usePendingBraiders();
  const { data: experts, isLoading: el } = usePendingExperts();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Verification"
        subtitle="Approve or reject new braider and expert profiles."
      />

      <section>
        <h2 className="mb-3 font-display text-lg text-plum">
          Braiders {braiders?.length ? `(${braiders.length})` : ""}
        </h2>
        {bl && <LoadingBlock />}
        {braiders && braiders.length === 0 && (
          <p className="text-sm text-slate">Nothing pending.</p>
        )}
        <div className="flex flex-col gap-3">
          {braiders?.map((b) => (
            <BraiderReview key={b.id} braider={b} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-plum">
          Experts {experts?.length ? `(${experts.length})` : ""}
        </h2>
        {el && <LoadingBlock />}
        {experts && experts.length === 0 && <p className="text-sm text-slate">Nothing pending.</p>}
        <div className="flex flex-col gap-3">
          {experts?.map((e) => (
            <ExpertReview key={e.id} expert={e} />
          ))}
        </div>
      </section>
    </div>
  );
}
