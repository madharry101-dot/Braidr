/**
 * UK tax year runs 6 April – 5 April, not the calendar year the PRD's
 * "Tax year summary: April–April" phrasing might suggest at a glance.
 * Returns e.g. "2026-27" for any date from 2026-04-06 through 2027-04-05.
 */
export function ukTaxYearFor(date: Date): string {
  const year = date.getUTCFullYear();
  const isBeforeApril6 =
    date.getUTCMonth() < 3 || (date.getUTCMonth() === 3 && date.getUTCDate() < 6);
  const startYear = isBeforeApril6 ? year - 1 : year;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}
