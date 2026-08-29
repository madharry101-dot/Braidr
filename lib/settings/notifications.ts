import type { Role } from "@/types/database";

// PRD v2.0 §4.10.1–3 — per-event email notification toggles. Absence of a
// key means "on" (opt-out model). "marketing" is deliberately not here — it
// is a consent decision (GDPR-02), handled by the Marketing toggle which
// also writes a consent_events row.
export type NotificationEvent = { key: string; label: string };

const CLIENT: NotificationEvent[] = [
  { key: "booking_confirmed", label: "Booking confirmed" },
  { key: "appointment_reminder", label: "Appointment reminder" },
  { key: "braidcare_window_live", label: "BraidCare check unlocks" },
  { key: "braidcare_report_ready", label: "BraidCare report ready" },
  { key: "rebooking_nudge", label: "Time to rebook" },
  { key: "expert_referral_followup", label: "Expert referral follow-up" },
  { key: "review_prompt", label: "Leave a review" },
];

const BRAIDER: NotificationEvent[] = [
  { key: "new_booking_request", label: "New booking request" },
  { key: "booking_confirmed", label: "Booking confirmed" },
  { key: "booking_cancelled", label: "Booking cancelled" },
  { key: "appointment_reminder", label: "Appointment reminder" },
  { key: "new_review", label: "New review" },
  { key: "braidcare_flag", label: "BraidCare flag on a client" },
  { key: "hmrc_deadline", label: "HMRC deadline reminders" },
  { key: "payout_received", label: "Payout received" },
  { key: "dispute_raised", label: "Dispute raised" },
];

const EXPERT: NotificationEvent[] = [
  { key: "new_referral", label: "New referral received" },
  { key: "client_consented", label: "Client consented to share data" },
];

const BY_ROLE: Record<Role, NotificationEvent[]> = {
  client: CLIENT,
  braider: BRAIDER,
  expert: EXPERT,
  admin: [],
};

export function notificationEventsFor(role: Role): NotificationEvent[] {
  return BY_ROLE[role] ?? [];
}

// A given event is enabled unless explicitly set to false.
export function isEnabled(prefs: Record<string, boolean>, key: string): boolean {
  return prefs[key] !== false;
}
