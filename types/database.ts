// Hand-written to match supabase/migrations/*.sql exactly, in the same shape
// `supabase gen types typescript` would produce.
//
// There's no live Supabase project yet to run that generator against — once
// one exists, regenerate this file from it and delete this comment; the
// generated file is the source of truth from then on, not this one.

import type { HairTexture, HairTypeValue } from "@/lib/hair/textures";
import type { BlogCategory, BlogStatus } from "@/lib/blog/types";

export type Role = "client" | "braider" | "expert" | "admin";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled_client"
  | "cancelled_braider"
  | "disputed"
  | "refunded"
  | "payment_failed";
export type ServiceCategory = "braids" | "locs" | "cornrows" | "twists" | "other";
export type BraidcareSessionType = "included" | "purchased_oneoff" | "subscription";
export type BraidcareSubscriptionStatus = "active" | "cancelled" | "past_due";
export type BraidcareSessionStatus = "pending" | "in_progress" | "completed" | "expired";
export type BraidcareOverallStatus =
  "looking_good" | "monitor_closely" | "consider_rest" | "seek_specialist";
export type BraidcareFlagSeverity = "low" | "medium" | "high";
export type ConsentType =
  | "terms_and_privacy"
  | "marketing"
  | "cookies_analytics"
  | "braidcare_photo_processing"
  | "expert_referral_share"
  | "newsletter";

/** Where a newsletter opt-in was captured — the "how did you get my address" answer. */
export type NewsletterConsentSource = "settings_page" | "blog_signup_form" | "registration";
export type NewsletterSendStatus = "queued" | "sent" | "failed";

export type ConditionFlag = {
  area: string;
  observation: string;
  severity: BraidcareFlagSeverity;
  action: string;
};

// A table with no client-reachable INSERT/UPDATE (service-role only, or —
// for profiles — created solely by a trigger). Using an empty object rather
// than `never` because @supabase/postgrest-js's GenericTable requires
// Insert/Update to extend Record<string, unknown>.
type NoClientWrite = Record<string, never>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: Role;
          full_name: string;
          display_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          city: string | null;
          stripe_customer_id: string | null;
          braidcare_client_subscribed: boolean;
          is_suspended: boolean;
          referral_code: string;
          referred_by: string | null;
          notification_preferences: Record<string, boolean>;
          date_of_birth: string | null;
          hair_type: HairTypeValue | null;
          hair_type_detail: string | null;
          hair_type_source: "self" | "braider_confirmed";
          hair_type_confirmed_by: string | null;
          hair_type_confirmed_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        // Normally created by the handle_new_user() trigger. The one
        // sanctioned service-role insert is /api/auth/complete-oauth-registration
        // (Google users have no role at signup, so the trigger skips them).
        Insert: {
          id: string;
          role: Role;
          full_name: string;
          referred_by?: string | null;
        };
        Update: Partial<{
          display_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          city: string | null;
          stripe_customer_id: string | null;
          braidcare_client_subscribed: boolean;
          notification_preferences: Record<string, boolean>;
          date_of_birth: string | null;
          hair_type: HairTypeValue | null;
          hair_type_detail: string | null;
          // Provenance columns. Owner (non-service) writes are constrained
          // by prevent_profile_privileged_field_update(): only → 'self' /
          // → null transitions are allowed. The service-role braider
          // confirmation route sets the authoritative values.
          hair_type_source: "self" | "braider_confirmed";
          hair_type_confirmed_by: string | null;
          hair_type_confirmed_at: string | null;
          deleted_at: string | null;
          // full_name is not owner-editable in any route today — it's only
          // in this type for the admin anonymisation path (DELETE
          // /api/admin/users/:id), which overwrites it with "Deleted User".
          full_name: string;
          is_suspended: boolean;
        }>;
        Relationships: [];
      };
      braider_profiles: {
        Row: {
          id: string;
          user_id: string;
          bio: string | null;
          specialisations: string[];
          city: string;
          area: string | null;
          years_experience: number | null;
          is_verified: boolean;
          is_active: boolean;
          braidcare_subscribed: boolean;
          braidcare_badge_active: boolean;
          braidr_pro_subscribed: boolean;
          stripe_account_id: string | null;
          stripe_charges_enabled: boolean;
          stripe_pro_subscription_id: string | null;
          verification_note: string | null;
          portfolio_photos: string[];
          avg_rating: number | null;
          total_reviews: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          city: string;
          bio?: string | null;
          specialisations?: string[];
          area?: string | null;
          years_experience?: number | null;
        };
        // Owner-editable fields plus the system-managed ones the guard
        // trigger protects at the DB level (stripe_account_id,
        // stripe_charges_enabled, is_verified, etc.) — see the comment on
        // the bookings Update type above for why this isn't NoClientWrite.
        // portfolio_photos is owner-writable directly (not guarded) — same
        // treatment as braidcare_sessions.photo_paths: an array the owner
        // manages themselves via upload/delete routes, not a system flag.
        Update: Partial<{
          bio: string | null;
          specialisations: string[];
          city: string;
          area: string | null;
          years_experience: number | null;
          portfolio_photos: string[];
          is_verified: boolean;
          is_active: boolean;
          braidcare_subscribed: boolean;
          braidcare_badge_active: boolean;
          braidr_pro_subscribed: boolean;
          stripe_account_id: string | null;
          stripe_charges_enabled: boolean;
          stripe_pro_subscription_id: string | null;
          verification_note: string | null;
          avg_rating: number | null;
          total_reviews: number;
        }>;
        Relationships: [];
      };
      newsletter_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          subscribed_at: string;
          unsubscribed_at: string | null;
          consent_source: NewsletterConsentSource;
          unsubscribe_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          consent_source: NewsletterConsentSource;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
        };
        Update: Partial<{
          subscribed_at: string;
          unsubscribed_at: string | null;
          consent_source: NewsletterConsentSource;
          unsubscribe_token: string;
        }>;
        Relationships: [];
      };
      newsletter_sends: {
        Row: {
          id: string;
          post_id: string;
          recipient_user_id: string;
          status: NewsletterSendStatus;
          attempts: number;
          last_error: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          post_id: string;
          recipient_user_id: string;
        };
        Update: Partial<{
          status: NewsletterSendStatus;
          attempts: number;
          last_error: string | null;
          sent_at: string | null;
        }>;
        Relationships: [];
      };
      blog_posts: {
        Row: {
          id: string;
          title: string;
          slug: string;
          body: string;
          excerpt: string;
          author_id: string;
          category: BlogCategory;
          status: BlogStatus;
          published_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_note: string | null;
          created_at: string;
          updated_at: string;
        };
        // status is not insertable: the enforce_blog_status trigger requires
        // every post to be created as a draft.
        Insert: {
          title: string;
          slug: string;
          body: string;
          excerpt: string;
          author_id: string;
          category: BlogCategory;
        };
        Update: Partial<{
          title: string;
          slug: string;
          body: string;
          excerpt: string;
          category: BlogCategory;
          status: BlogStatus;
          published_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_note: string | null;
        }>;
        Relationships: [];
      };
      braider_texture_specialisations: {
        Row: {
          id: string;
          braider_id: string;
          texture: HairTexture;
          is_verified: boolean;
          verified_at: string | null;
          created_at: string;
        };
        // Owner inserts/deletes rows to change their specialisations;
        // is_verified/verified_at are trigger-maintained (no owner UPDATE
        // policy), so they're not in Insert.
        Insert: {
          braider_id: string;
          texture: HairTexture;
        };
        Update: Partial<{
          is_verified: boolean;
          verified_at: string | null;
        }>;
        Relationships: [];
      };
      braider_portfolio_photos: {
        Row: {
          id: string;
          braider_id: string;
          storage_path: string;
          texture: HairTexture | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          braider_id: string;
          storage_path: string;
          texture?: HairTexture | null;
          sort_order?: number;
        };
        Update: Partial<{
          texture: HairTexture | null;
          sort_order: number;
        }>;
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          braider_id: string;
          name: string;
          category: ServiceCategory;
          price_from: number;
          price_to: number | null;
          duration_mins: number;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          braider_id: string;
          name: string;
          category: ServiceCategory;
          price_from: number;
          duration_mins: number;
          price_to?: number | null;
          description?: string | null;
          is_active?: boolean;
        };
        Update: Partial<{
          name: string;
          category: ServiceCategory;
          price_from: number;
          price_to: number | null;
          duration_mins: number;
          description: string | null;
          is_active: boolean;
        }>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          client_id: string;
          braider_id: string;
          service_id: string;
          status: BookingStatus;
          appointment_at: string;
          braidcare_live_at: string; // generated column
          amount_pence: number;
          commission_pence: number;
          braider_payout_pence: number;
          stripe_payment_intent_id: string | null; // null until checkout.session.completed
          stripe_transfer_id: string | null;
          stripe_checkout_session_id: string | null;
          sessions_allocated: number;
          sessions_used: number;
          cancellation_reason: string | null;
          completed_at: string | null;
          pending_reschedule_at: string | null;
          reschedule_requested_by: string | null;
          dispute_reason: string | null;
          pre_dispute_status: string | null;
          dispute_resolution_note: string | null;
          created_at: string;
          updated_at: string;
        };
        // Client-side insert is only ever a 'pending' row (see migration
        // note); every other field/transition is written via the
        // service-role client. Update is the REAL settable shape, not
        // NoClientWrite — bookings has zero authenticated-role UPDATE
        // policy at all (see the migration), so RLS itself is what blocks
        // the regular session client, regardless of what this type allows.
        // Widening it here just lets the admin client (which shares this
        // same Database type) actually perform those writes.
        Insert: {
          id: string; // generated client-side (crypto.randomUUID()) before the Stripe call — see bookings/route.ts
          client_id: string;
          braider_id: string;
          service_id: string;
          appointment_at: string;
          amount_pence: number;
          commission_pence: number;
          braider_payout_pence: number;
          status: "pending";
          stripe_checkout_session_id?: string | null;
        };
        Update: Partial<{
          status: BookingStatus;
          appointment_at: string;
          stripe_payment_intent_id: string | null;
          stripe_transfer_id: string | null;
          stripe_checkout_session_id: string | null;
          cancellation_reason: string | null;
          completed_at: string | null;
          pending_reschedule_at: string | null;
          reschedule_requested_by: string | null;
          dispute_reason: string | null;
          pre_dispute_status: string | null;
          dispute_resolution_note: string | null;
        }>;
        Relationships: [];
      };
      braidcare_sessions: {
        Row: {
          id: string;
          booking_id: string | null; // null = standalone session (subscriber, no booking)
          client_id: string;
          session_number: number;
          session_type: BraidcareSessionType;
          status: BraidcareSessionStatus;
          photos_count: number;
          photo_paths: string[]; // never selectable via the authenticated role — see migration
          ai_raw_response: unknown | null; // never selectable via the authenticated role
          overall_status: BraidcareOverallStatus | null;
          summary: string | null;
          condition_flags: ConditionFlag[];
          recommendations: string[];
          referral_suggested: boolean;
          referral_threshold_met: string | null;
          report_delivered_at: string | null;
          created_at: string;
        };
        Insert: {
          booking_id?: string | null;
          client_id: string;
          session_number: number;
          session_type: BraidcareSessionType;
        };
        // Real shape for the service-role client (photo upload + AI analysis
        // routes) to write — same reasoning as bookings.Update: RLS (no
        // authenticated UPDATE policy on this table at all) is what actually
        // enforces "service-role only", not this type.
        Update: Partial<{
          status: BraidcareSessionStatus;
          photos_count: number;
          photo_paths: string[];
          ai_raw_response: unknown;
          overall_status: BraidcareOverallStatus | null;
          summary: string | null;
          condition_flags: ConditionFlag[];
          recommendations: string[];
          referral_suggested: boolean;
          referral_threshold_met: string | null;
          report_delivered_at: string | null;
        }>;
        Relationships: [];
      };
      expert_profiles: {
        Row: {
          id: string;
          user_id: string;
          credentials: string;
          specialisation: string[];
          clinic_name: string | null;
          city: string;
          consultation_fee_pence: number | null;
          booking_url: string | null;
          is_verified: boolean;
          is_active: boolean;
          referral_count: number;
          credential_doc_path: string | null; // never selectable via the authenticated role
          verification_note: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          credentials: string;
          city: string;
          specialisation?: string[];
          clinic_name?: string | null;
          consultation_fee_pence?: number | null;
          booking_url?: string | null;
          credential_doc_path?: string | null;
        };
        // is_verified/is_active/referral_count/verification_note are
        // service-role only (admin review) — same reasoning as
        // braider_profiles.Update on why this isn't NoClientWrite.
        Update: Partial<{
          credentials: string;
          specialisation: string[];
          clinic_name: string | null;
          city: string;
          consultation_fee_pence: number | null;
          booking_url: string | null;
          credential_doc_path: string | null;
          is_verified: boolean;
          is_active: boolean;
          referral_count: number;
          verification_note: string | null;
        }>;
        Relationships: [];
      };
      expert_referrals: {
        Row: {
          id: string;
          expert_id: string;
          client_id: string;
          braidcare_session_id: string | null;
          consent_given: boolean;
          status: "referred" | "completed";
          referral_fee_pence: number | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          expert_id: string;
          client_id: string;
          braidcare_session_id?: string | null;
          consent_given: boolean;
        };
        Update: Partial<{
          status: "referred" | "completed";
          referral_fee_pence: number | null;
          completed_at: string | null;
        }>;
        Relationships: [];
      };
      content_moderation_log: {
        Row: {
          id: string;
          admin_id: string;
          target_type: "avatar" | "portfolio_photo";
          target_user_id: string;
          removed_path: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          admin_id: string;
          target_type: "avatar" | "portfolio_photo";
          target_user_id: string;
          removed_path: string;
          reason: string;
        };
        Update: NoClientWrite;
        Relationships: [];
      };
      platform_announcements: {
        Row: {
          id: string;
          admin_id: string;
          segment: Record<string, unknown>;
          subject: string;
          message: string;
          recipient_count: number;
          created_at: string;
        };
        Insert: {
          admin_id: string;
          segment: Record<string, unknown>;
          subject: string;
          message: string;
          recipient_count: number;
        };
        Update: NoClientWrite;
        Relationships: [];
      };
      braider_availability_rules: {
        Row: {
          id: string;
          braider_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          created_at: string;
        };
        Insert: {
          braider_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Update: Partial<{ day_of_week: number; start_time: string; end_time: string }>;
        Relationships: [];
      };
      braider_blocked_dates: {
        Row: {
          id: string;
          braider_id: string;
          blocked_date: string;
          reason: string | null;
          created_at: string;
        };
        Insert: { braider_id: string; blocked_date: string; reason?: string | null };
        Update: Partial<{ blocked_date: string; reason: string | null }>;
        Relationships: [];
      };
      braidr_pro_progress: {
        Row: {
          id: string;
          braider_id: string;
          assessment_completed: boolean;
          assessment_results: Record<string, unknown> | null;
          step2_hmrc_completed: boolean;
          step2_utr: string | null; // application-layer ciphertext — see lib/crypto/utr.ts
          step3_insurance_completed: boolean;
          step3_insurance_doc_path: string | null;
          step4_banking_completed: boolean;
          step4_badge_awarded: boolean; // service-role only — see migration guard trigger
          step5_accessed: boolean;
          overall_progress_pct: number; // generated column
          created_at: string;
          updated_at: string;
        };
        Insert: {
          braider_id: string;
          assessment_completed?: boolean;
          assessment_results?: Record<string, unknown> | null;
        };
        Update: Partial<{
          assessment_completed: boolean;
          assessment_results: Record<string, unknown> | null;
          step2_hmrc_completed: boolean;
          step2_utr: string | null;
          step3_insurance_completed: boolean;
          step3_insurance_doc_path: string | null;
          step4_banking_completed: boolean;
          step4_badge_awarded: boolean; // service-role only — see guard trigger (20260826000009 / 20260829000001)
          step5_accessed: boolean;
        }>;
        Relationships: [];
      };
      income_records: {
        Row: {
          id: string;
          braider_id: string;
          booking_id: string;
          service_name: string;
          gross_amount_pence: number;
          commission_pence: number;
          net_amount_pence: number;
          tax_year: string;
          payment_date: string;
          created_at: string;
        };
        // Real insert shape for the service-role client (the Stripe webhook
        // handler) to use — NoClientWrite here would also block that
        // legitimate write, same reasoning as bookings.Update above. RLS
        // (no INSERT policy for `authenticated` at all) is what actually
        // keeps this service-role-only, not this type.
        Insert: {
          braider_id: string;
          booking_id: string;
          service_name: string;
          gross_amount_pence: number;
          commission_pence: number;
          net_amount_pence: number;
          tax_year: string;
          payment_date: string;
        };
        Update: NoClientWrite;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          booking_id: string;
          client_id: string;
          braider_id: string;
          rating: number;
          comment: string | null;
          is_published: boolean;
          created_at: string;
        };
        Insert: {
          booking_id: string;
          client_id: string;
          braider_id: string;
          rating: number;
          comment?: string | null;
        };
        Update: NoClientWrite; // moderation only, via service role
        Relationships: [];
      };
      data_export_requests: {
        Row: {
          id: string;
          user_id: string;
          status: "pending" | "fulfilled" | "cancelled";
          requested_at: string;
          fulfilled_at: string | null;
        };
        Insert: { user_id: string; status?: "pending" | "fulfilled" | "cancelled" };
        Update: Partial<{
          status: "pending" | "fulfilled" | "cancelled";
          fulfilled_at: string | null;
        }>;
        Relationships: [];
      };
      consent_events: {
        // Append-only GDPR consent log — TRD v2.0 Section 3.5.
        Row: {
          id: string;
          user_id: string;
          consent_type: ConsentType;
          consent_version: string;
          granted: boolean;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          consent_type: ConsentType;
          consent_version: string;
          granted: boolean;
          ip_address?: string | null;
        };
        Update: NoClientWrite; // append-only — never updated
        Relationships: [];
      };
      braidcare_subscriptions: {
        // TRD v2.0 §3.3 — client £7.99/mo unlimited BraidCare. Written only
        // by the Stripe webhook (service role).
        Row: {
          id: string;
          user_id: string;
          role: "client" | "braider";
          stripe_subscription_id: string;
          status: BraidcareSubscriptionStatus;
          price_pence: number;
          current_period_end: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          role: "client" | "braider";
          stripe_subscription_id: string;
          status?: BraidcareSubscriptionStatus;
          price_pence: number;
          current_period_end: string;
        };
        Update: Partial<{
          status: BraidcareSubscriptionStatus;
          stripe_subscription_id: string;
          price_pence: number;
          current_period_end: string;
        }>;
        Relationships: [];
      };
    };
    Views: {
      // Public-facing subset of `profiles` for people who chose to be
      // listed (active braiders, verified active experts). Read this —
      // never the profiles table — when displaying someone other than the
      // caller: the base table carries phone, date_of_birth,
      // stripe_customer_id and referral_code. See 20260911000001.
      public_profiles: {
        Row: {
          id: string;
          name: string;
          avatar_url: string | null;
          city: string | null;
          role: Role;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Functions: {
      get_own_braidcare_photos: {
        Args: { p_session_id: string };
        Returns: string[];
      };
      increment_booking_sessions_used: {
        Args: { p_booking_id: string };
        Returns: undefined;
      };
      increment_expert_referral_count: {
        Args: { p_expert_id: string };
        Returns: undefined;
      };
      email_is_google_only: {
        Args: { p_email: string };
        Returns: boolean;
      };
    };
    Enums: {
      role: Role;
      booking_status: BookingStatus;
      service_category: ServiceCategory;
      braidcare_session_type: BraidcareSessionType;
      braidcare_session_status: BraidcareSessionStatus;
      braidcare_overall_status: BraidcareOverallStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
