"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";
import { useMarketingConsent, useUpdateMarketingConsent } from "@/lib/hooks/settings";
import { useNewsletter, useUpdateNewsletter } from "@/lib/hooks/newsletter";
import { NEWSLETTER_MAX_PER_MONTH } from "@/lib/newsletter/copy";

// The two opt-IN email consents, under one header per the founder's call:
// keep them as separate toggles (they are separate consents, logged
// separately, versioned separately), but group them so the distinction is
// legible. Neither is in the Notifications card above — that one is
// transactional and opt-out; these are marketing under PECR reg. 22 and
// start unticked because no consent row exists until the box is ticked.

export function EmailPreferencesSection() {
  const marketing = useMarketingConsent();
  const updateMarketing = useUpdateMarketingConsent();
  const newsletter = useNewsletter();
  const updateNewsletter = useUpdateNewsletter();

  const loading = marketing.isLoading || newsletter.isLoading;
  if (loading || !newsletter.data) return <Card>Loading…</Card>;

  return (
    <Card>
      <CardTitle>Email preferences</CardTitle>
      <p className="mt-1 text-sm text-slate">
        Optional. Off unless you turn them on, and you can change your mind any time.
      </p>

      <div className="mt-4 flex flex-col gap-5">
        <Checkbox
          label="Marketing emails"
          checked={marketing.data?.opted_in ?? false}
          disabled={marketing.isLoading || updateMarketing.isPending}
          onChange={(e) => updateMarketing.mutate(e.target.checked)}
          hint="New features, offers, and braiding tips from Braidr."
        />

        <Checkbox
          label="Educational emails"
          checked={newsletter.data.subscribed}
          disabled={updateNewsletter.isPending}
          onChange={(e) => updateNewsletter.mutate(e.target.checked)}
          hint={`An email when we publish new hair and scalp health content — no more than ${NEWSLETTER_MAX_PER_MONTH} a month. Every one has a one-click unsubscribe that doesn't need you to sign in.`}
        />
      </div>

      {(updateMarketing.isError || updateNewsletter.isError) && (
        <Alert tone="error" className="mt-3">
          Couldn&rsquo;t save that. Please try again.
        </Alert>
      )}

      <p className="mt-4 text-xs text-slate">
        We record every change to these settings, and when it was made, as data-protection law
        requires.
      </p>
    </Card>
  );
}
