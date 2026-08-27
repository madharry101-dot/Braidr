import { z } from "zod";

export const createExpertProfileSchema = z.object({
  credentials: z.string().trim().min(1).max(300),
  specialisation: z.array(z.string().trim().min(1)).max(20).default([]),
  clinic_name: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1),
  consultation_fee_pence: z.number().int().positive().optional(),
  booking_url: z.string().url().optional(),
});
export type CreateExpertProfileInput = z.infer<typeof createExpertProfileSchema>;

export const updateExpertProfileSchema = createExpertProfileSchema.partial();
export type UpdateExpertProfileInput = z.infer<typeof updateExpertProfileSchema>;

export const createReferralSchema = z.object({
  expert_id: z.string().uuid(),
  braidcare_session_id: z.string().uuid().optional(),
  consent_given: z.boolean(),
});
export type CreateReferralInput = z.infer<typeof createReferralSchema>;

export const verifyExpertSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});
export type VerifyExpertInput = z.infer<typeof verifyExpertSchema>;

export const completeReferralSchema = z.object({
  referral_fee_pence: z.number().int().min(1500).max(2500), // TRD business model: £15-25
});
export type CompleteReferralInput = z.infer<typeof completeReferralSchema>;
