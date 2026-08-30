"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { useNewsletter, useUpdateNewsletter } from "@/lib/hooks/newsletter";
import { NEWSLETTER_MAX_PER_MONTH } from "@/lib/newsletter/copy";

// Its own card, deliberately NOT a row in the Notifications list above it.
//
// That list is transactional mail (booking confirmed, appointment reminder,
// BraidCare unlocked) on an opt-OUT model, which is lawful because those
// messages are part of the service someone asked for. This is marketing
// mail under PECR reg. 22 and needs an affirmative opt-in. Putting them in
// one list is how a transactional default quietly becomes marketing
// consent, so they stay apart on screen as well as in the schema.
//
// The checkbox starts unticked because no subscription row exists until
// someone ticks it — there is no default-on state to render.

export function NewsletterSection() {
  const { data, isLoading } = useNewsletter();
  const update = useUpdateNewsletter();

  if (isLoading || !data) return <Card>Loading…</Card>;

  return (
    <Card>
      <CardTitle>Educational emails</CardTitle>
      <p className="mt-1 text-sm text-slate">
        Separate from the notifications above, which are about your own bookings and checks.
      </p>

      <div className="mt-4">
        <Checkbox
          label={`Email me when we publish new educational content — no more than ${NEWSLETTER_MAX_PER_MONTH} a month`}
          checked={data.subscribed}
          disabled={update.isPending}
          onChange={(e) => update.mutate(e.target.checked)}
          hint="Articles on braiding, hair and scalp care, including guidance from the dermatologists who advise Braidr. Never marketing for a product, and you can unsubscribe from any email without signing in."
        />
      </div>

      {update.isError && (
        <Alert tone="error" className="mt-3">
          Couldn&rsquo;t save that. Please try again.
        </Alert>
      )}

      {data.subscribed && data.subscribed_at && (
        <p className="mt-3 text-xs text-slate">
          You opted in on{" "}
          {new Date(data.subscribed_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          . We keep a record of that, and of any change, as data-protection law requires.
        </p>
      )}
    </Card>
  );
}
