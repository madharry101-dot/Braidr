import { z } from "zod";

// POST /api/settings/consent — records one consent_events row (TRD v2.0
// Section 3.5 / 6.4). Used by every consent touchpoint in PRD v2.0 §4.12:
// registration, cookie banner, BraidCare first-use + withdrawal, expert
// referral share, OAuth completion.
export const consentSchema = z.object({
  consent_type: z.enum([
    "terms_and_privacy",
    "marketing",
    "cookies_analytics",
    "braidcare_photo_processing",
    "expert_referral_share",
  ]),
  consent_version: z.string().min(1).max(64),
  granted: z.boolean(),
});
export type ConsentInput = z.infer<typeof consentSchema>;
