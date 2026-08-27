"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { RequireBraiderProfile } from "@/components/braider/require-profile";
import {
  useSetAvailabilityRules,
  useBlockDate,
  useUnblockDate,
} from "@/lib/hooks/braider-dashboard";
import { ApiError } from "@/lib/api/client";
import { formatDate, toDateKey } from "@/lib/format";
import { DAY_NAMES, type AvailabilityRule, type BlockedDate } from "@/lib/types/braidmatch";

// Mon-first display order; value is the real day_of_week (0 = Sunday).
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type DayState = { enabled: boolean; start: string; end: string };

const hhmm = (t: string) => t.slice(0, 5);

function buildInitial(rules: AvailabilityRule[]): Record<number, DayState> {
  const state: Record<number, DayState> = {};
  for (const d of DAY_ORDER) {
    const rule = rules.find((r) => r.day_of_week === d);
    state[d] = rule
      ? { enabled: true, start: hhmm(rule.start_time), end: hhmm(rule.end_time) }
      : { enabled: false, start: "09:00", end: "17:00" };
  }
  return state;
}

function AvailabilityManager({
  braiderId,
  rules,
  blocked,
}: {
  braiderId: string;
  rules: AvailabilityRule[];
  blocked: BlockedDate[];
}) {
  const setRules = useSetAvailabilityRules(braiderId);
  const blockDate = useBlockDate(braiderId);
  const unblockDate = useUnblockDate(braiderId);

  const [days, setDays] = useState<Record<number, DayState>>(() => buildInitial(rules));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newBlock, setNewBlock] = useState("");
  const [blockError, setBlockError] = useState<string | null>(null);

  function updateDay(d: number, patch: Partial<DayState>) {
    setDays((prev) => ({ ...prev, [d]: { ...prev[d], ...patch } }));
    setSaved(false);
  }

  async function saveHours() {
    setError(null);
    setSaved(false);
    const payload = DAY_ORDER.filter((d) => days[d].enabled).map((d) => ({
      day_of_week: d,
      start_time: days[d].start,
      end_time: days[d].end,
    }));
    if (payload.some((r) => r.end_time <= r.start_time)) {
      setError("Each day’s finish time must be after its start time.");
      return;
    }
    try {
      await setRules.mutateAsync(payload);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your hours.");
    }
  }

  async function addBlock() {
    setBlockError(null);
    if (!newBlock) return;
    try {
      await blockDate.mutateAsync({ date: newBlock });
      setNewBlock("");
    } catch (err) {
      setBlockError(err instanceof ApiError ? err.message : "Couldn't block that date.");
    }
  }

  const today = toDateKey(new Date());

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your hours"
        subtitle="The weekly window clients can book within. Times are your local time."
      />

      <Card>
        <h2 className="font-display text-lg text-plum">Weekly hours</h2>
        {error && (
          <Alert tone="error" className="mt-3">
            {error}
          </Alert>
        )}
        {saved && (
          <Alert tone="success" className="mt-3">
            Hours saved.
          </Alert>
        )}
        <div className="mt-4 flex flex-col divide-y divide-mist">
          {DAY_ORDER.map((d) => {
            const day = days[d];
            return (
              <div key={d} className="flex flex-wrap items-center gap-3 py-3">
                <label className="flex w-32 items-center gap-2 text-sm font-medium text-plum">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={day.enabled}
                    onChange={(e) => updateDay(d, { enabled: e.target.checked })}
                  />
                  {DAY_NAMES[d]}
                </label>
                {day.enabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={day.start}
                      onChange={(e) => updateDay(d, { start: e.target.value })}
                      className="min-h-[44px] rounded border border-mist bg-white px-2"
                    />
                    <span className="text-slate">to</span>
                    <input
                      type="time"
                      value={day.end}
                      onChange={(e) => updateDay(d, { end: e.target.value })}
                      className="min-h-[44px] rounded border border-mist bg-white px-2"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-slate">Closed</span>
                )}
              </div>
            );
          })}
        </div>
        <Button className="mt-4 sm:!w-auto" loading={setRules.isPending} onClick={saveHours}>
          Save hours
        </Button>
      </Card>

      <Card>
        <h2 className="font-display text-lg text-plum">Blocked dates</h2>
        <p className="mt-1 text-sm text-slate">
          Holidays or days off. Clients can&rsquo;t book on these dates even if they fall in your
          weekly hours.
        </p>
        {blockError && (
          <Alert tone="error" className="mt-3">
            {blockError}
          </Alert>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input
            type="date"
            min={today}
            value={newBlock}
            onChange={(e) => setNewBlock(e.target.value)}
            className="min-h-[44px] rounded border border-mist bg-white px-3"
          />
          <Button
            size="sm"
            className="sm:!w-auto"
            disabled={!newBlock}
            loading={blockDate.isPending}
            onClick={addBlock}
          >
            Block date
          </Button>
        </div>

        {blocked.length > 0 && (
          <ul className="mt-4 flex flex-col divide-y divide-mist">
            {blocked.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-plum">{formatDate(b.blocked_date)}</span>
                <button
                  type="button"
                  onClick={() => unblockDate.mutate(b.blocked_date)}
                  className="text-teal-deep hover:text-plum"
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function BraiderAvailabilityPage() {
  return (
    <RequireBraiderProfile>
      {(me) => (
        <AvailabilityManager
          braiderId={me.profile.id}
          rules={me.availability_rules}
          blocked={me.blocked_dates}
        />
      )}
    </RequireBraiderProfile>
  );
}
