"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useBillingInfo } from "@/lib/hooks/settings";
import { useCancelBraidcareSubscription } from "@/lib/hooks/braidcare";
import { formatMoney, formatDate } from "@/lib/format";
import type { Role } from "@/types/database";

export function BillingSection({ role }: { role: Role }) {
  const { data, isLoading } = useBillingInfo();
  const cancel = useCancelBraidcareSubscription();
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  if (isLoading || !data) return <Card>Loading…</Card>;

  const sub = data.braidcare_subscription;

  return (
    <Card>
      <CardTitle>Billing</CardTitle>

      <div className="mt-3 flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-plum">BraidCare subscription</p>
            {sub?.status === "active" ? (
              <Badge tone="braidcare">Active</Badge>
            ) : sub?.status === "past_due" ? (
              <Badge tone="warning">Past due</Badge>
            ) : (
              <span className="text-sm text-slate">Not subscribed</span>
            )}
          </div>
          {sub?.status === "active" && (
            <>
              <p className="mt-1 text-sm text-slate">
                {formatMoney(sub.price_pence)}/month · renews {formatDate(sub.current_period_end)}
              </p>
              {error && (
                <Alert tone="error" className="mt-2">
                  {error}
                </Alert>
              )}
              {cancelled ? (
                <p className="mt-2 text-sm text-slate">
                  Cancels at the end of the current period. You keep access until then.
                </p>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 sm:!w-auto"
                  loading={cancel.isPending}
                  onClick={async () => {
                    setError(null);
                    try {
                      await cancel.mutateAsync();
                      setCancelled(true);
                    } catch {
                      setError("Couldn't cancel. Please try again.");
                    }
                  }}
                >
                  Cancel subscription
                </Button>
              )}
            </>
          )}
          {!sub && (
            <p className="mt-1 text-sm text-slate">
              <Link href="/braidcare" className="text-teal-deep underline hover:text-plum">
                Subscribe for unlimited BraidCare
              </Link>
            </p>
          )}
        </div>

        {role === "braider" && (
          <div className="border-t border-mist pt-3">
            <p className="text-sm font-medium text-plum">Payouts & Stripe</p>
            <Link
              href="/dashboard/braider/payments"
              className="text-sm text-teal-deep underline hover:text-plum"
            >
              Manage your Stripe payout account
            </Link>
          </div>
        )}

        {data.invoices.length > 0 && (
          <div className="border-t border-mist pt-3">
            <p className="text-sm font-medium text-plum">Receipts</p>
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {data.invoices.map((inv, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="text-slate">
                    {formatDate(inv.date)} · {formatMoney(inv.amount_pence)}
                  </span>
                  {inv.pdf && (
                    <a
                      href={inv.pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-deep underline hover:text-plum"
                    >
                      Receipt
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
