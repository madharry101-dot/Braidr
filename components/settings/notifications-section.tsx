"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { useNotificationSettings, useUpdateNotificationSettings } from "@/lib/hooks/settings";
import { isEnabled } from "@/lib/settings/notifications";

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 text-sm text-plum">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-mist text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      />
    </label>
  );
}

// Transactional email only — messages about the caller's own bookings and
// BraidCare checks. Opt-out (all on by default), which is lawful because
// these are part of the service the user asked for. Marketing/educational
// email lives in EmailPreferencesSection and is opt-IN — kept apart on
// screen as well as in the schema so a transactional default can't be
// mistaken for marketing consent.
export function NotificationsSection() {
  const { data, isLoading } = useNotificationSettings();
  const update = useUpdateNotificationSettings();

  if (isLoading || !data) return <Card>Loading…</Card>;

  return (
    <Card>
      <CardTitle>Notifications</CardTitle>
      <p className="mt-1 text-sm text-slate">
        Emails about your own bookings and checks. All are on unless you turn them off.
      </p>

      <div className="mt-3 divide-y divide-mist">
        {data.events.map((ev) => (
          <Toggle
            key={ev.key}
            label={ev.label}
            checked={isEnabled(data.preferences, ev.key)}
            disabled={update.isPending}
            onChange={(v) => update.mutate({ [ev.key]: v })}
          />
        ))}
      </div>
    </Card>
  );
}
