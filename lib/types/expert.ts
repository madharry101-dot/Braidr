export type ExpertCard = {
  id: string;
  credentials: string;
  specialisation: string[];
  clinic_name: string | null;
  city: string;
  consultation_fee_pence: number | null;
  booking_url: string | null;
};

export type MyExpertProfile = ExpertCard & {
  user_id: string;
  is_verified: boolean;
  is_active: boolean;
  verification_note: string | null;
};

/** From GET /api/experts/referrals as the expert (own referrals). */
export type ExpertReferral = {
  id: string;
  client_id: string;
  braidcare_session_id: string | null;
  consent_given: boolean;
  status: "referred" | "completed";
  created_at: string;
};

export type ExpertProfileForm = {
  credentials: string;
  specialisation: string[];
  clinic_name?: string;
  city: string;
  consultation_fee_pence?: number;
  booking_url?: string;
};

export const SPECIALISATION_OPTIONS = [
  "traction alopecia",
  "scalp dermatology",
  "trichology",
  "hair loss",
  "scalp psoriasis",
  "folliculitis",
  "afro hair care",
] as const;
