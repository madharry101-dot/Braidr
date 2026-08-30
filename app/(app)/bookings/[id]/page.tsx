"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { LoadingBlock } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/booking/status-badge";
import { ConfirmHairTypeCard } from "@/components/booking/confirm-hair-type-card";
import {
  useBooking,
  useCancelBooking,
  useRescheduleBooking,
  useConfirmReschedule,
  useCompleteBooking,
} from "@/lib/hooks/braidmatch";
import { useSession } from "@/lib/hooks/use-session";
import { ApiError } from "@/lib/api/client";
import { formatDateTime, formatMoney, formatDuration } from "@/lib/format";

function hoursUntil(iso: string) {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}

function refundEstimate(hours: number, amountPence: number) {
  if (hours >= 48) return amountPence;
  if (hours >= 24) return Math.round(amountPence / 2);
  return 0;
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { data: booking, isLoading, isError, error } = useBooking(id);

  const cancel = useCancelBooking(id);
  const reschedule = useRescheduleBooking(id);
  const confirmReschedule = useConfirmReschedule(id);
  const complete = useCompleteBooking(id);

  const [showCancel, setShowCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <LoadingBlock label="Loading booking" />;
  if (isError || !booking) {
    return <Alert tone="error">{error?.message ?? "This booking could not be found."}</Alert>;
  }

  const myUserId = session?.user.id;
  const isBraiderViewer = session?.profile?.role === "braider";
  const hours = hoursUntil(booking.appointment_at);
  const appointmentPassed = hours <= 0;

  const canCancel = booking.status === "confirmed" || booking.status === "pending";
  const isPending = booking.status === "pending";
  const canReschedule =
    booking.status === "confirmed" && !booking.pending_reschedule_at && !appointmentPassed;
  const canComplete = isBraiderViewer && booking.status === "confirmed" && appointmentPassed;
  // Part 1 — post-appointment hair-type step. Offered once the appointment
  // has actually happened, and never blocking: it sits below the actions
  // and "Mark as completed" works whether or not the braider uses it.
  const canConfirmHairType =
    isBraiderViewer &&
    appointmentPassed &&
    (booking.status === "confirmed" || booking.status === "completed");
  const awaitingMyRescheduleConfirm =
    Boolean(booking.pending_reschedule_at) &&
    booking.reschedule_requested_by !== myUserId &&
    booking.status === "confirmed";

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      setShowCancel(false);
      setShowReschedule(false);
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again."
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/bookings" className="text-sm text-teal-deep hover:text-plum">
        ← All bookings
      </Link>
      <PageHeader title={booking.service_name} />

      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <StatusBadge status={booking.status} />
          {booking.service_category && <Badge>{booking.service_category}</Badge>}
        </div>
        <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
          <dt className="text-slate">{isBraiderViewer ? "Client" : "Braider"}</dt>
          <dd className="text-plum">
            {isBraiderViewer ? (booking.client_name ?? "Client") : booking.braider_name}
          </dd>
          <dt className="text-slate">When</dt>
          <dd className="text-plum">{formatDateTime(booking.appointment_at)}</dd>
          {booking.service_duration_mins != null && (
            <>
              <dt className="text-slate">Duration</dt>
              <dd className="text-plum">{formatDuration(booking.service_duration_mins)}</dd>
            </>
          )}
          <dt className="text-slate">{isBraiderViewer ? "Your payout" : "Paid"}</dt>
          <dd className="text-plum">
            {formatMoney(isBraiderViewer ? booking.braider_payout_pence : booking.amount_pence)}
          </dd>
        </dl>

        {booking.status === "confirmed" && !isBraiderViewer && (
          <p className="mt-4 rounded bg-success-bg px-3 py-2 text-sm text-success">
            BraidCare opens {formatDateTime(booking.braidcare_live_at)} (24h before your
            appointment).
          </p>
        )}
        {isPending && !isBraiderViewer && (
          <p className="bg-mist/50 mt-4 rounded px-3 py-2 text-sm text-slate">
            Payment wasn&rsquo;t completed, so this slot isn&rsquo;t confirmed yet. Cancel it below
            if you no longer want it.
          </p>
        )}
        {booking.cancellation_reason && (
          <p className="mt-4 text-sm text-slate">Reason: {booking.cancellation_reason}</p>
        )}
      </Card>

      {actionError && (
        <Alert tone="error" className="mb-4">
          {actionError}
        </Alert>
      )}

      {/* Pending reschedule — needs the other party's confirmation */}
      {booking.pending_reschedule_at && booking.status === "confirmed" && (
        <Card className="mb-4">
          <p className="text-sm text-plum">
            A new time has been proposed:{" "}
            <span className="font-medium">{formatDateTime(booking.pending_reschedule_at)}</span>
          </p>
          {awaitingMyRescheduleConfirm ? (
            <Button
              size="sm"
              className="mt-3 sm:!w-auto"
              loading={confirmReschedule.isPending}
              onClick={() => runAction(() => confirmReschedule.mutateAsync())}
            >
              Accept new time
            </Button>
          ) : (
            <p className="mt-1 text-sm text-slate">Waiting for the other person to confirm.</p>
          )}
        </Card>
      )}

      {/* Actions */}
      {(canCancel || canReschedule || canComplete) && (
        <div className="flex flex-wrap gap-3">
          {canComplete && (
            <Button
              size="sm"
              className="sm:!w-auto"
              loading={complete.isPending}
              onClick={() => runAction(() => complete.mutateAsync())}
            >
              Mark as completed
            </Button>
          )}
          {canReschedule && (
            <Button
              variant="secondary"
              size="sm"
              className="sm:!w-auto"
              onClick={() => {
                setShowReschedule((v) => !v);
                setShowCancel(false);
              }}
            >
              Reschedule
            </Button>
          )}
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="sm:!w-auto"
              onClick={() => {
                setShowCancel((v) => !v);
                setShowReschedule(false);
              }}
            >
              Cancel booking
            </Button>
          )}
        </div>
      )}

      {/* Post-appointment: confirm or update the client's hair type. Optional. */}
      {canConfirmHairType && (
        <div className="mt-4">
          <ConfirmHairTypeCard
            bookingId={booking.id}
            clientName={booking.client_name ?? "this client"}
            clientHairType={booking.client_hair_type ?? null}
          />
        </div>
      )}

      {/* Reschedule form */}
      {showReschedule && (
        <Card className="mt-4">
          <h3 className="font-medium text-plum">Propose a new time</h3>
          <p className="mt-1 text-sm text-slate">
            The other person will need to accept before the appointment moves.
          </p>
          <input
            type="datetime-local"
            className="mt-3 min-h-[44px] w-full rounded border border-mist bg-white px-3 sm:w-auto"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="sm:!w-auto"
              disabled={!newTime}
              loading={reschedule.isPending}
              onClick={() =>
                runAction(() => reschedule.mutateAsync(new Date(newTime).toISOString()))
              }
            >
              Send proposal
            </Button>
          </div>
        </Card>
      )}

      {/* Cancel confirmation */}
      {showCancel && (
        <Card className="mt-4">
          <h3 className="font-medium text-plum">Cancel this booking?</h3>
          <p className="mt-1 text-sm text-slate">
            {isPending ? (
              <>This booking hasn&rsquo;t been paid for. Cancelling frees up the time slot. </>
            ) : (
              !isBraiderViewer && (
                <>
                  Based on the notice period, your estimated refund is{" "}
                  <span className="font-medium text-plum">
                    {formatMoney(refundEstimate(hours, booking.amount_pence))}
                  </span>{" "}
                  of {formatMoney(booking.amount_pence)}.{" "}
                </>
              )
            )}
            This can&rsquo;t be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="danger"
              size="sm"
              className="sm:!w-auto"
              loading={cancel.isPending}
              onClick={() => runAction(() => cancel.mutateAsync(undefined))}
            >
              Yes, cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="sm:!w-auto"
              onClick={() => setShowCancel(false)}
            >
              Keep booking
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
