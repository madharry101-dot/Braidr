"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { api } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { NEWSLETTER_MAX_PER_MONTH } from "@/lib/newsletter/copy";

type Subscriber = {
  user_id: string;
  name: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
  consent_source: string;
  active: boolean;
};
type AuditRow = {
  user_id: string;
  name: string;
  granted: boolean;
  consent_version: string;
  ip_address: string | null;
  created_at: string;
};
type NewsletterAdmin = {
  active_count: number;
  total_ever: number;
  subscribers: Subscriber[];
  audit_log: AuditRow[];
};

export default function AdminNewsletterPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "newsletter"],
    queryFn: () => api.get<NewsletterAdmin>("/admin/newsletter"),
  });

  if (isLoading) return <LoadingBlock label="Loading subscribers" />;
  if (isError || !data) return <Alert tone="error">Couldn&rsquo;t load newsletter data.</Alert>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Newsletter"
        subtitle="Subscribers and the consent audit trail."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-slate">Currently subscribed</p>
          <p className="mt-1 font-display text-2xl text-plum">{data.active_count}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate">Ever subscribed</p>
          <p className="mt-1 font-display text-2xl text-plum">{data.total_ever}</p>
        </Card>
      </div>

      {/* Stated plainly here because it's a promise made at opt-in, and the
          person deciding whether to publish a fifth article this month is
          the person looking at this screen. */}
      <Alert tone="info">
        Subscribers were told they&rsquo;d get no more than {NEWSLETTER_MAX_PER_MONTH} emails a
        month. Sends are triggered only by publishing an article — there is no manual send tool,
        deliberately.
      </Alert>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Consent audit log</CardTitle>
          <a
            href="/api/admin/newsletter?format=csv"
            className="text-sm text-teal-deep underline hover:text-plum"
          >
            Export CSV
          </a>
        </div>
        <p className="mt-1 text-sm text-slate">
          Every opt-in and withdrawal, append-only. This is what a compliance request would be
          answered from.
        </p>

        {data.audit_log.length === 0 ? (
          <p className="mt-4 text-sm text-slate">No consent events recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-slate">
                <tr className="border-b border-mist">
                  <th className="py-2 font-medium">When</th>
                  <th className="py-2 font-medium">Who</th>
                  <th className="py-2 font-medium">Action</th>
                  <th className="py-2 font-medium">Version</th>
                  <th className="py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {data.audit_log.map((e, i) => (
                  <tr key={`${e.user_id}-${e.created_at}-${i}`}>
                    <td className="py-2 text-slate">{formatDateTime(e.created_at)}</td>
                    <td className="py-2 text-plum">{e.name}</td>
                    <td className="py-2">
                      <Badge tone={e.granted ? "braidcare" : "neutral"}>
                        {e.granted ? "Opted in" : "Withdrew"}
                      </Badge>
                    </td>
                    <td className="py-2 text-slate">{e.consent_version}</td>
                    <td className="py-2 text-slate">{e.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle className="text-lg">Subscribers</CardTitle>
        {data.subscribers.length === 0 ? (
          <p className="mt-2 text-sm text-slate">Nobody has subscribed yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-slate">
                <tr className="border-b border-mist">
                  <th className="py-2 font-medium">Who</th>
                  <th className="py-2 font-medium">Opted in</th>
                  <th className="py-2 font-medium">Where</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {data.subscribers.map((s) => (
                  <tr key={s.user_id}>
                    <td className="py-2 text-plum">{s.name}</td>
                    <td className="py-2 text-slate">{formatDateTime(s.subscribed_at)}</td>
                    <td className="py-2 text-slate">{s.consent_source.replace(/_/g, " ")}</td>
                    <td className="py-2">
                      {s.active ? (
                        <Badge tone="braidcare">Subscribed</Badge>
                      ) : (
                        <Badge tone="neutral">
                          Unsubscribed{" "}
                          {s.unsubscribed_at ? formatDateTime(s.unsubscribed_at) : ""}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
