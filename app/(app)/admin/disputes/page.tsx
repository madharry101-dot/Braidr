"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { useDisputes, useResolveDispute } from "@/lib/hooks/admin";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { DisputeRow } from "@/lib/types/admin";

function DisputeCard({ dispute }: { dispute: DisputeRow }) {
  const resolve = useResolveDispute();
  const [mode, setMode] = useState<"idle" | "refund" | "dismiss">("idle");
  const [note, setNote] = useState("");
  const [refundPounds, setRefundPounds] = useState((dispute.amount_pence / 100).toString());
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      const res = await resolve.mutateAsync({
        id: dispute.id,
        resolution: mode === "refund" ? "refund" : "dismiss",
        note: note.trim(),
        refund_pence: mode === "refund" ? Math.round(parseFloat(refundPounds) * 100) : undefined,
      });
      const r = res as {
        resolution: string;
        transfer_reversed?: boolean;
        transfer_reversal_error?: string | null;
      };
      if (r.transfer_reversal_error) {
        setDoneMsg(
          `Refunded. Note: the braider's payout couldn't be reversed automatically (${r.transfer_reversal_error}) — reconcile manually.`
        );
      } else {
        setDoneMsg(mode === "refund" ? "Client refunded." : "Dispute dismissed.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't resolve this dispute.");
    }
  }

  if (doneMsg) {
    return (
      <Card>
        <Alert tone="success">{doneMsg}</Alert>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-plum">{dispute.service_name}</h3>
          <p className="text-sm text-slate">
            {dispute.client_name} ↔ {dispute.braider_name} ·{" "}
            {formatDateTime(dispute.appointment_at)}
          </p>
        </div>
        <span className="text-sm text-slate">{formatMoney(dispute.amount_pence)}</span>
      </div>

      {dispute.dispute_reason && (
        <p className="rounded bg-white px-3 py-2 text-sm text-plum">
          &ldquo;{dispute.dispute_reason}&rdquo;
        </p>
      )}

      <p className="text-xs text-slate">
        Was <span className="font-medium">{dispute.pre_dispute_status ?? "confirmed"}</span> before
        the dispute
        {dispute.stripe_transfer_id
          ? " · braider payout already sent"
          : " · braider not yet paid out"}
        .
      </p>

      {error && <Alert tone="error">{error}</Alert>}

      {mode === "idle" ? (
        <div className="flex gap-2">
          <Button
            variant="danger"
            size="sm"
            className="sm:!w-auto"
            onClick={() => setMode("refund")}
          >
            Refund client
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="sm:!w-auto"
            onClick={() => setMode("dismiss")}
          >
            Dismiss
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded border border-mist bg-white p-3">
          {mode === "refund" && (
            <label className="text-sm text-plum">
              Refund amount (£)
              <input
                type="number"
                min={0}
                max={dispute.amount_pence / 100}
                step="0.01"
                value={refundPounds}
                onChange={(e) => setRefundPounds(e.target.value)}
                className="mt-1 block w-32 rounded border border-mist px-2 py-1"
              />
            </label>
          )}
          <textarea
            rows={2}
            placeholder="Resolution note (internal record)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded border border-mist px-3 py-2 text-sm text-plum"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="sm:!w-auto"
              loading={resolve.isPending}
              disabled={!note.trim()}
              onClick={submit}
            >
              {mode === "refund" ? "Confirm refund" : "Confirm dismissal"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="sm:!w-auto"
              onClick={() => setMode("idle")}
            >
              Back
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function AdminDisputesPage() {
  const { data: disputes, isLoading, isError } = useDisputes();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Disputes" subtitle="Booking disputes raised by a client or braider." />

      {isLoading && <LoadingBlock />}
      {isError && <Alert tone="error">Couldn&rsquo;t load disputes.</Alert>}
      {disputes && disputes.length === 0 && (
        <div className="rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
          <p className="font-medium text-plum">No open disputes</p>
        </div>
      )}
      {disputes && disputes.length > 0 && (
        <div className="flex flex-col gap-3">
          {disputes.map((d) => (
            <DisputeCard key={d.id} dispute={d} />
          ))}
        </div>
      )}
    </div>
  );
}
