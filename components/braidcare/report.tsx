import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BraidcareDisclaimer } from "@/components/braidcare/disclaimer";
import { formatDate } from "@/lib/format";
import {
  OVERALL_STATUS_META,
  SEVERITY_META,
  type BraidcareSessionDetail,
} from "@/lib/types/braidcare";
import { cn } from "@/lib/cn";

const STATUS_BAR: Record<string, string> = {
  success: "bg-success-bg text-success",
  info: "bg-white text-slate border border-mist",
  warning: "bg-[var(--color-warning-bg)] text-gold-deep",
  danger: "bg-danger-bg text-danger",
};

export function BraidcareReport({ session }: { session: BraidcareSessionDetail }) {
  const meta = session.overall_status ? OVERALL_STATUS_META[session.overall_status] : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/braidcare" className="text-sm text-teal-deep hover:text-plum">
          ← BraidCare
        </Link>
        <h1 className="mt-2 font-display text-2xl text-plum">Session {session.session_number}</h1>
        {session.report_delivered_at && (
          <p className="text-sm text-slate">{formatDate(session.report_delivered_at)}</p>
        )}
      </div>

      {meta && (
        <div className={cn("rounded-lg p-4", STATUS_BAR[meta.tone])}>
          <p className="font-display text-lg">{meta.label}</p>
          <p className="mt-0.5 text-sm">{meta.blurb}</p>
        </div>
      )}

      {session.summary && (
        <Card>
          <p className="text-plum">{session.summary}</p>
        </Card>
      )}

      {session.referral_suggested && (
        <Card className="border-danger/40 bg-danger-bg">
          <h2 className="font-display text-lg text-danger">Worth a professional look</h2>
          <p className="mt-1 text-sm text-plum">
            Based on what we observed, we&rsquo;d suggest speaking to a scalp health specialist or
            your GP.
          </p>
          <Link
            href={`/experts?refer=${session.id}`}
            className="mt-3 inline-flex min-h-[44px] items-center rounded bg-plum px-4 text-sm font-medium text-white hover:bg-plum-hover"
          >
            Find a specialist
          </Link>
        </Card>
      )}

      {session.condition_flags.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg text-plum">What we noticed</h2>
          <div className="flex flex-col gap-3">
            {session.condition_flags.map((flag, i) => {
              const sev = SEVERITY_META[flag.severity];
              return (
                <Card key={i}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-plum">{flag.area}</h3>
                    <Badge tone={sev.tone}>{sev.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate">{flag.observation}</p>
                  <p className="mt-2 text-sm text-plum">
                    <span className="font-medium">What helps: </span>
                    {flag.action}
                  </p>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {session.recommendations.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg text-plum">Aftercare</h2>
          <Card>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-plum">
              {session.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <BraidcareDisclaimer />
    </div>
  );
}
