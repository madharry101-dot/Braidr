"use client";

import { Card, CardTitle } from "@/components/ui/card";
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
  useMarketingConsent,
  useUpdateMarketingConsent,
} from "@/lib/hooks/settings";
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

export function NotificationsSection() {
  const { data, isLoading } = useNotificationSettings();
  const update = useUpdateNotificationSettings();
  const marketing = useMarketingConsent();
  const updateMarketing = useUpdateMarketingConsent();

  if (isLoading || !data) return <Card>Loading…</Card>;

  return (
    <Card>
      <CardTitle>Notifications</CardTitle>
      <p className="mt-1 text-sm text-slate">
        Email notifications. All are on unless you turn them off.
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

      <div className="mt-3 border-t border-mist pt-3">
        <Toggle
          label="Marketing emails — new features, offers, and braiding tips"
          checked={marketing.data?.opted_in ?? false}
          disabled={marketing.isLoading || updateMarketing.isPending}
          onChange={(v) => updateMarketing.mutate(v)}
        />
        <p className="text-xs text-slate">
          We record every change to this setting as required by data-protection law.
        </p>
      </div>
    </Card>
  );
}
