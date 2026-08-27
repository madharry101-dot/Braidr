// Machine-readable error codes used across the API. Codes named directly in
// the TRD/PRD (BraidCare eligibility, TRD 4.5.1 / 8.2.1) are kept verbatim;
// the generic ones are additions needed for a consistent envelope everywhere
// else, not called out individually in the source documents.
export const ERROR_CODES = [
  // Generic
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ROLE_MISMATCH",
  "NOT_FOUND",
  "RATE_LIMITED",
  "INTERNAL_ERROR",

  // Bookings
  "BOOKING_NOT_FOUND",
  "BOOKING_NOT_CONFIRMED",
  "SLOT_UNAVAILABLE",
  "SERVICE_NOT_FOUND",
  "BRAIDER_NOT_FOUND",
  "BRAIDER_NOT_PAYMENT_READY",
  "APPOINTMENT_IN_PAST",
  "APPOINTMENT_NOT_YET_OCCURRED",
  "RESCHEDULE_NOT_PENDING",

  // BraidCare (TRD 4.5.1 / 8.2.1 — exact names)
  "WINDOW_NOT_OPEN",
  "NO_SESSIONS_LEFT",

  // Stripe / payments
  "PAYMENT_FAILED",
  "WEBHOOK_SIGNATURE_INVALID",

  // BraidMatch
  "STYLE_NOT_IDENTIFIED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
