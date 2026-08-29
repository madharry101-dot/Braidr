// The /r/{code} handler sets `braidr_ref`; both registration paths read it
// client-side to attribute the new account (PRD v2.0 FR-REF-01.4).
export function readReferralCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)braidr_ref=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}
