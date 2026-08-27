const REMINDER_OFFSETS_DAYS = [60, 30, 7]; // PRD FR-PRO-03.5

/** The next 31 Jan or 31 Jul on/after `from`. */
function nextDeadline(from: Date): Date {
  const year = from.getUTCFullYear();
  const candidates = [
    new Date(Date.UTC(year, 0, 31)), // 31 Jan
    new Date(Date.UTC(year, 6, 31)), // 31 Jul
    new Date(Date.UTC(year + 1, 0, 31)),
  ];
  return candidates.find((d) => d.getTime() >= from.getTime())!;
}

/**
 * True if `today` is exactly one of the reminder offsets (60/30/7 days)
 * before the next HMRC self-assessment deadline. Used by the daily cron —
 * see /api/cron/hmrc-deadline-reminders.
 */
export function isReminderDay(today: Date): { isReminderDay: boolean; deadline: Date } {
  const midnightToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  const deadline = nextDeadline(midnightToday);
  const daysUntil = Math.round(
    (deadline.getTime() - midnightToday.getTime()) / (24 * 60 * 60 * 1000)
  );
  return { isReminderDay: REMINDER_OFFSETS_DAYS.includes(daysUntil), deadline };
}
