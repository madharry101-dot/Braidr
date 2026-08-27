import { z } from "zod";

// PRD FR-PRO-01.5 — 5-question readiness assessment.
export const assessmentSchema = z.object({
  hmrc_registered: z.boolean(),
  has_insurance: z.boolean(),
  has_business_bank_account: z.boolean(),
  files_tax_return: z.boolean(),
  tracks_income: z.boolean(),
});
export type AssessmentInput = z.infer<typeof assessmentSchema>;

// UTR (Unique Taxpayer Reference) is a 10-digit HMRC identifier.
export const step2Schema = z.object({
  utr: z.string().regex(/^\d{10}$/, "UTR must be exactly 10 digits"),
});
export type Step2Input = z.infer<typeof step2Schema>;
