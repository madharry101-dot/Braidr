import type { BraidcareOverallStatus, ConditionFlag } from "@/types/database";

export type { BraidcareOverallStatus, ConditionFlag };

export type BraidcareSessionStatus = "pending" | "in_progress" | "completed" | "expired";
export type BraidcareSessionType = "included" | "purchased_oneoff" | "subscription";

/** Row from GET /api/braidcare/sessions (list) and /overview. */
export type BraidcareSessionSummary = {
  id: string;
  booking_id: string;
  session_number: number;
  session_type: BraidcareSessionType;
  status: BraidcareSessionStatus;
  overall_status: BraidcareOverallStatus | null;
  summary: string | null;
  referral_suggested: boolean;
  report_delivered_at: string | null;
  created_at: string;
};

/** Full session from GET /api/braidcare/sessions/:id. */
export type BraidcareSessionDetail = BraidcareSessionSummary & {
  photos_count: number;
  condition_flags: ConditionFlag[];
  recommendations: string[];
  referral_threshold_met: string | null;
};

export type BraidcareBookingRow = {
  booking_id: string;
  service_name: string;
  braider_name: string;
  appointment_at: string;
  braidcare_live_at: string;
  window_open: boolean;
  hours_until_open: number;
  sessions_allocated: number;
  sessions_used: number;
  sessions_remaining: number;
  can_start: boolean;
};

export type BraidcareOverview = {
  client_subscribed: boolean;
  bookings: BraidcareBookingRow[];
  sessions: BraidcareSessionSummary[];
};

/** Braider-facing row — flags and status only, never the summary or photos. */
export type BraiderClientSession = {
  id: string;
  session_number: number;
  overall_status: BraidcareOverallStatus | null;
  condition_flags: ConditionFlag[];
  referral_suggested: boolean;
  report_delivered_at: string | null;
  client_name: string;
  service_name: string;
  appointment_at: string | null;
};

export const OVERALL_STATUS_META: Record<
  BraidcareOverallStatus,
  { label: string; tone: "success" | "info" | "warning" | "danger"; blurb: string }
> = {
  looking_good: {
    label: "Looking good",
    tone: "success",
    blurb: "No areas of concern in the photos you shared.",
  },
  monitor_closely: {
    label: "Keep an eye on it",
    tone: "info",
    blurb: "A few things worth watching over the next couple of weeks.",
  },
  consider_rest: {
    label: "Consider a rest",
    tone: "warning",
    blurb: "Signs that a break from tight styles may help your scalp recover.",
  },
  seek_specialist: {
    label: "Worth a professional look",
    tone: "danger",
    blurb: "We'd suggest speaking to a scalp health specialist about what we observed.",
  },
};

export const SEVERITY_META: Record<
  "low" | "medium" | "high",
  { label: string; tone: "neutral" | "warning" | "danger" }
> = {
  low: { label: "Low", tone: "neutral" },
  medium: { label: "Medium", tone: "warning" },
  high: { label: "Higher", tone: "danger" },
};

// Shown throughout BraidCare — the no-diagnosis framing is a deliberate
// regulatory boundary (stays outside MHRA medical device classification).
export const BRAIDCARE_DISCLAIMER =
  "BraidCare is a wellness monitoring tool, not a medical device. It does not diagnose any condition. If anything concerns you, speak to a scalp health specialist or your GP.";
