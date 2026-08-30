import type { BookingStatus, ServiceCategory } from "@/types/database";
import type { HairTexture, HairTypeValue } from "@/lib/hair/textures";

/** One portfolio photo, braider-owned management view. */
export type PortfolioPhoto = {
  id: string;
  storage_path: string;
  texture: HairTexture | null;
};

/** A braider's declared texture specialisation + its verification state. */
export type TextureSpec = {
  texture: HairTexture;
  is_verified: boolean;
};

// Client-facing shapes returned by the /api/braiders and /api/bookings
// routes. Kept here so pages and hooks share one definition.

export type BraiderCard = {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  specialisations: string[];
  city: string;
  area: string | null;
  years_experience: number | null;
  is_verified: boolean;
  braidcare_badge_active: boolean;
  avg_rating: number | null;
  total_reviews: number;
  price_from_pence: number | null;
  /** Present on the single-braider response only; storage paths in the public portfolio-photos bucket. */
  portfolio_photos?: string[];
  /** Textures this braider is VERIFIED for (>= 1 tagged portfolio photo). Unverified specialisations are never sent to clients. */
  verified_textures?: HairTexture[];
};

export type Service = {
  id: string;
  name: string;
  category: ServiceCategory;
  price_from: number;
  price_to: number | null;
  duration_mins: number;
  description: string | null;
  /** Present on braider-owned (management) responses. */
  is_active?: boolean;
};

export type AvailabilityRule = {
  id: string;
  day_of_week: number; // 0 = Sunday
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
};

export type BlockedDate = {
  id: string;
  blocked_date: string; // "YYYY-MM-DD"
  reason: string | null;
};

export type MyBraiderProfile = {
  id: string;
  bio: string | null;
  specialisations: string[];
  city: string;
  area: string | null;
  years_experience: number | null;
  is_verified: boolean;
  is_active: boolean;
  braidcare_badge_active: boolean;
  braidcare_subscribed: boolean;
  braidr_pro_subscribed: boolean;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  portfolio_photos: PortfolioPhoto[];
  texture_specialisations: TextureSpec[];
  avg_rating: number | null;
  total_reviews: number;
  verification_note: string | null;
};

export type BraiderMe = {
  profile: MyBraiderProfile | null;
  services: Service[];
  availability_rules: AvailabilityRule[];
  blocked_dates: BlockedDate[];
};

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  "braids",
  "locs",
  "cornrows",
  "twists",
  "other",
];

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type BraiderDetail = {
  braider: BraiderCard;
  services: Service[];
  reviews: Review[];
};

type BookingBase = {
  id: string;
  braider_id: string;
  client_id: string;
  service_id: string;
  status: BookingStatus;
  appointment_at: string;
  amount_pence: number;
  created_at: string;
};

/** Row shape from GET /api/bookings (list) — hydrated with names. */
export type Booking = BookingBase & {
  service_name: string;
  braider_name: string;
  client_name: string | null;
};

/** Row shape from GET /api/bookings/:id — full `bookings` row + hydrated names. */
export type BookingDetail = BookingBase & {
  braidcare_live_at: string;
  commission_pence: number;
  braider_payout_pence: number;
  sessions_allocated: number;
  sessions_used: number;
  cancellation_reason: string | null;
  completed_at: string | null;
  pending_reschedule_at: string | null;
  reschedule_requested_by: string | null;
  service_name: string;
  service_duration_mins: number | null;
  service_category: string | null;
  braider_name: string;
  client_name: string | null;
  /** Present only when the braider is viewing. Non-null = a braider has
   *  already confirmed it; null = not yet recorded. A client's own
   *  self-report is never shared with the braider. */
  client_hair_type?: HairTypeValue | null;
};

export const STYLE_OPTIONS = [
  "box braids",
  "knotless braids",
  "cornrows",
  "faux locs",
  "senegalese twists",
  "passion twists",
  "goddess braids",
  "fulani braids",
  "micro braids",
  "locs",
] as const;

export const UK_CITIES = [
  "London",
  "Birmingham",
  "Manchester",
  "Leeds",
  "Glasgow",
  "Liverpool",
  "Bristol",
  "Sheffield",
  "Edinburgh",
  "Aberdeen",
  "Nottingham",
  "Leicester",
] as const;
