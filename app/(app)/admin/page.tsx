"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import {
  usePlatformReport,
  usePendingBraiders,
  usePendingExperts,
  useDisputes,
} from "@/lib/hooks/admin";
import { formatMoney } from "@/lib/format";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-mist bg-surface p-4 shadow-card">
      <p className="text-sm text-slate">{label}</p>
      <p className="mt-1 font-display text-2xl text-plum">{value}</p>
    </div>
  );
}

export default function AdminOverview() {
  const { data: report, isLoading, isError } = usePlatformReport();
  const { data: pendingBraiders } = usePendingBraiders();
  const { data: pendingExperts } = usePendingExperts();
  const { data: disputes } = useDisputes();

  const queue =
    (pendingBraiders?.length ?? 0) + (pendingExperts?.length ?? 0) + (disputes?.length ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Admin" subtitle="Platform health, moderation and support." />

      {queue > 0 && (
        <Alert tone="info">
          {queue} item{queue === 1 ? "" : "s"} need attention:{" "}
          {(pendingBraiders?.length ?? 0) > 0 && (
            <Link href="/admin/verification" className="underline">
              {pendingBraiders?.length} braider{pendingBraiders?.length === 1 ? "" : "s"}
            </Link>
          )}
          {(pendingExperts?.length ?? 0) > 0 && (
            <>
              {(pendingBraiders?.length ?? 0) > 0 && ", "}
              <Link href="/admin/verification" className="underline">
                {pendingExperts?.length} expert{pendingExperts?.length === 1 ? "" : "s"}
              </Link>
            </>
          )}
          {(disputes?.length ?? 0) > 0 && (
            <>
              {queue - (disputes?.length ?? 0) > 0 && ", "}
              <Link href="/admin/disputes" className="underline">
                {disputes?.length} dispute{disputes?.length === 1 ? "" : "s"}
              </Link>
            </>
          )}
          .
        </Alert>
      )}

      {isLoading && <LoadingBlock />}
      {isError && <Alert tone="error">Couldn&rsquo;t load the platform report.</Alert>}

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Active users"
              value={
                report.active_users.clients +
                report.active_users.braiders +
                report.active_users.experts
              }
            />
            <Stat label="Bookings (all time)" value={report.bookings.total} />
            <Stat label="GMV" value={formatMoney(report.gmv_pence)} />
            <Stat
              label="Commission earned"
              value={formatMoney(report.financial.total_commission_pence)}
            />
            <Stat label="Braiders" value={report.active_users.braiders} />
            <Stat label="Pro subscribers" value={report.pro_subscribers} />
            <Stat
              label="BraidCare checks"
              value={`${report.braidcare.completed_sessions}/${report.braidcare.total_sessions}`}
            />
            <Stat label="Payouts due" value={formatMoney(report.financial.payouts_due_pence)} />
          </div>

          <Card>
            <CardTitle className="text-base">Bookings by status</CardTitle>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(report.bookings.by_status).map(([status, n]) => (
                <Badge key={status} tone="neutral">
                  {status.replace(/_/g, " ")}: {n}
                </Badge>
              ))}
            </div>
          </Card>
        </>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            href: "/admin/verification",
            title: "Verification",
            body: `${(pendingBraiders?.length ?? 0) + (pendingExperts?.length ?? 0)} pending`,
          },
          { href: "/admin/disputes", title: "Disputes", body: `${disputes?.length ?? 0} open` },
          { href: "/admin/users", title: "Users", body: "Search, suspend, remove" },
          { href: "/admin/blog", title: "Blog", body: "Write, review and publish articles" },
          { href: "/admin/referrals", title: "Referrals", body: "Record completed consultations" },
          { href: "/admin/announcements", title: "Announcements", body: "Message user segments" },
          { href: "/admin/moderation", title: "Moderation", body: "Content removal log" },
        ].map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full transition-shadow hover:shadow-[0_2px_4px_rgba(45,27,53,0.1),0_8px_24px_rgba(45,27,53,0.1)]">
              <CardTitle className="text-base">{c.title}</CardTitle>
              <p className="mt-1 text-sm text-slate">{c.body}</p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
