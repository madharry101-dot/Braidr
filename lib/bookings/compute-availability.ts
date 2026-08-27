import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SLOT_GRANULARITY_MINS = 30;

/**
 * Returns available appointment start times (as ISO strings) for a braider
 * between dateFrom/dateTo (inclusive, "YYYY-MM-DD"), for a service of the
 * given duration.
 *
 * KNOWN SIMPLIFICATION: start_time/end_time on braider_availability_rules
 * are treated as UTC clock times, not real local time with DST handling
 * (Europe/London). Fine for now — Braidr launches UK-only and the gap
 * between UTC and Europe/London is at most one hour — but worth fixing
 * with a real IANA timezone conversion before this matters for precision
 * (e.g. displaying "9:00 AM" consistently across BST/GMT).
 */
export async function computeAvailability(
  supabase: SupabaseClient<Database>,
  braiderId: string,
  dateFrom: string,
  dateTo: string,
  durationMins: number
): Promise<string[]> {
  const [{ data: rules }, { data: blockedDates }, { data: bookings }] = await Promise.all([
    supabase
      .from("braider_availability_rules")
      .select("day_of_week, start_time, end_time")
      .eq("braider_id", braiderId),
    supabase
      .from("braider_blocked_dates")
      .select("blocked_date")
      .eq("braider_id", braiderId)
      .gte("blocked_date", dateFrom)
      .lte("blocked_date", dateTo),
    supabase
      .from("bookings")
      .select("appointment_at, service_id")
      .eq("braider_id", braiderId)
      .in("status", ["pending", "confirmed"])
      .gte("appointment_at", `${dateFrom}T00:00:00Z`)
      .lte("appointment_at", `${dateTo}T23:59:59Z`),
  ]);

  const rulesByDay = new Map<number, Array<{ start_time: string; end_time: string }>>();
  for (const rule of rules ?? []) {
    const list = rulesByDay.get(rule.day_of_week) ?? [];
    list.push(rule);
    rulesByDay.set(rule.day_of_week, list);
  }

  const blockedSet = new Set((blockedDates ?? []).map((b) => b.blocked_date));

  const serviceIds = [...new Set((bookings ?? []).map((b) => b.service_id))];
  const { data: services } = serviceIds.length
    ? await supabase.from("services").select("id, duration_mins").in("id", serviceIds)
    : { data: [] };
  const durationById = new Map((services ?? []).map((s) => [s.id, s.duration_mins]));

  const existingIntervals = (bookings ?? []).map((b) => {
    const start = new Date(b.appointment_at);
    const mins = durationById.get(b.service_id) ?? 0;
    return { start, end: new Date(start.getTime() + mins * 60_000) };
  });

  const slots: string[] = [];
  const cursor = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);

  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const dayOfWeek = cursor.getUTCDay();

    if (!blockedSet.has(dateStr)) {
      for (const rule of rulesByDay.get(dayOfWeek) ?? []) {
        const [startH, startM] = rule.start_time.split(":").map(Number);
        const [endH, endM] = rule.end_time.split(":").map(Number);

        let slotStart = new Date(cursor);
        slotStart.setUTCHours(startH, startM, 0, 0);
        const windowEnd = new Date(cursor);
        windowEnd.setUTCHours(endH, endM, 0, 0);

        while (slotStart.getTime() + durationMins * 60_000 <= windowEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + durationMins * 60_000);
          const isPast = slotStart.getTime() <= Date.now();
          const overlaps = existingIntervals.some((i) => i.start < slotEnd && i.end > slotStart);

          if (!isPast && !overlaps) slots.push(slotStart.toISOString());

          slotStart = new Date(slotStart.getTime() + SLOT_GRANULARITY_MINS * 60_000);
        }
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return slots;
}
