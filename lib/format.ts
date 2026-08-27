// Display formatters. Braidr is UK-only, so everything is en-GB / GBP.

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 8500 -> "£85", 8550 -> "£85.50" */
export function formatMoney(pence: number): string {
  return gbp.format(pence / 100);
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}
export function formatDateTime(iso: string): string {
  return `${dateFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))}`;
}
export function formatDayLong(iso: string): string {
  return dayFmt.format(new Date(iso));
}

/** minutes -> "3h 30m" / "45m" */
export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "YYYY-MM-DD" for a Date, in local time. */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
