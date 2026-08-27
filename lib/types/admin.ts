import type { Role } from "@/types/database";

export type PendingBraider = {
  id: string;
  user_id: string;
  name: string;
  bio: string | null;
  specialisations: string[];
  city: string;
  area: string | null;
  years_experience: number | null;
  portfolio_photos: string[];
  created_at: string;
};

export type PendingExpert = {
  id: string;
  user_id: string;
  name: string;
  credentials: string;
  specialisation: string[];
  clinic_name: string | null;
  city: string;
  consultation_fee_pence: number | null;
  credential_doc_path: string | null;
  verification_note: string | null;
  created_at: string;
};

export type DisputeRow = {
  id: string;
  client_name: string;
  braider_name: string;
  service_name: string;
  appointment_at: string;
  amount_pence: number;
  dispute_reason: string | null;
  pre_dispute_status: string | null;
  stripe_transfer_id: string | null;
  created_at: string;
};

export type AdminUser = {
  id: string;
  role: Role;
  full_name: string;
  display_name: string | null;
  city: string | null;
  is_suspended: boolean;
  created_at: string;
};

export type AdminReferral = {
  id: string;
  expert_id: string;
  expert_name: string;
  client_id: string;
  braidcare_session_id: string | null;
  consent_given: boolean;
  status: "referred" | "completed";
  referral_fee_pence: number | null;
  completed_at: string | null;
  created_at: string;
};

export type PlatformReport = {
  active_users: { clients: number; braiders: number; experts: number };
  bookings: { total: number; by_status: Record<string, number> };
  gmv_pence: number;
  braidcare: { total_sessions: number; completed_sessions: number };
  pro_subscribers: number;
  financial: { total_commission_pence: number; payouts_due_pence: number };
  time_series: {
    period: "week" | "month";
    buckets: { bucket: string; bookings: number; gmv_pence: number }[];
  };
};

export type ModerationLogEntry = {
  id: string;
  admin_id: string;
  target_type: "avatar" | "portfolio_photo";
  target_user_id: string;
  removed_path: string;
  reason: string;
  created_at: string;
};

export type Announcement = {
  id: string;
  segment: Record<string, unknown>;
  subject: string;
  message: string;
  recipient_count: number;
  created_at: string;
};
