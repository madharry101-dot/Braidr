"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { RequireBraiderProfile } from "@/components/braider/require-profile";
import { useProIncome } from "@/lib/hooks/pro";
import { formatMoney, formatDate } from "@/lib/format";
import type { IncomeRecord } from "@/lib/types/pro";

async function downloadInvoice(bookingId: string, onError: (msg: string) => void) {
  try {
    const res = await fetch("/api/pro/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      onError(body?.error?.message ?? "Couldn't generate that invoice.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${bookingId.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    onError("Couldn't download the invoice.");
  }
}

function IncomeTable({
  records,
  onInvoiceError,
}: {
  records: IncomeRecord[];
  onInvoiceError: (m: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-mist">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-mist bg-white text-left text-slate">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Service</th>
            <th className="px-3 py-2 text-right font-medium">Gross</th>
            <th className="px-3 py-2 text-right font-medium">Commission</th>
            <th className="px-3 py-2 text-right font-medium">Net</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-mist last:border-0">
              <td className="whitespace-nowrap px-3 py-2 text-plum">
                {formatDate(r.payment_date)}
              </td>
              <td className="px-3 py-2 text-plum">{r.service_name}</td>
              <td className="px-3 py-2 text-right text-plum">
                {formatMoney(r.gross_amount_pence)}
              </td>
              <td className="px-3 py-2 text-right text-slate">
                −{formatMoney(r.commission_pence)}
              </td>
              <td className="px-3 py-2 text-right font-medium text-plum">
                {formatMoney(r.net_amount_pence)}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => downloadInvoice(r.booking_id, onInvoiceError)}
                  className="text-xs font-medium text-teal-deep hover:text-plum"
                >
                  Invoice
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IncomeScreen() {
  const { data, isLoading, isError } = useProIncome();
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  if (isLoading) return <LoadingBlock label="Loading your income record" />;
  if (isError || !data) return <Alert tone="error">Couldn&rsquo;t load your income record.</Alert>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Income & invoices"
        subtitle="Every completed booking is recorded here automatically."
        action={
          <Link
            href="/dashboard/braider/pro"
            className="text-sm font-medium text-teal-deep hover:text-plum"
          >
            ← Pathway
          </Link>
        }
      />

      {data.tax_year_summaries.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.tax_year_summaries.map((s) => (
            <Card key={s.tax_year}>
              <p className="text-sm font-medium text-plum">Tax year {s.tax_year}</p>
              <dl className="mt-2 flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate">Gross</dt>
                  <dd className="text-plum">{formatMoney(s.total_gross_pence)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate">Net (after commission)</dt>
                  <dd className="text-plum">{formatMoney(s.total_net_pence)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate">Est. tax (20% indicator)</dt>
                  <dd className="text-plum">{formatMoney(s.estimated_tax_pence)}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}

      {invoiceError && <Alert tone="error">{invoiceError}</Alert>}

      {data.records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
          <p className="font-medium text-plum">No income recorded yet</p>
          <p className="mt-1 text-sm text-slate">
            When a booking is paid, it shows up here with the commission already worked out.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-plum">All records</h2>
            <a
              href="/api/pro/income/export"
              className="rounded border border-mist px-3 py-2 text-sm font-medium text-teal-deep hover:border-plum"
            >
              Export CSV
            </a>
          </div>
          <IncomeTable records={data.records} onInvoiceError={setInvoiceError} />
        </>
      )}

      <p className="text-xs text-slate">{data.disclaimer}</p>
    </div>
  );
}

export default function BraiderProIncomePage() {
  return <RequireBraiderProfile>{() => <IncomeScreen />}</RequireBraiderProfile>;
}
