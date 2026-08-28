import { z } from "zod";

// PRD FR-AUTH-01.4: role selection at registration determines dashboard and
// permissions. Admin accounts are never self-registered.
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  full_name: z.string().trim().min(1, "Full name is required.").max(200),
  role: z.enum(["client", "braider", "expert"]),
  // GDPR-01: must be an explicit, unbundled opt-in. The API rejects false.
  accepted_terms: z
    .boolean()
    .refine((v) => v === true, "You must accept the Terms and Privacy Policy to register."),
  // GDPR-02: separate, unchecked by default, never a condition of registering.
  marketing_opt_in: z.boolean().default(false),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// Completes a new Google-OAuth account: role choice + GDPR-09 consent.
export const completeOAuthRegistrationSchema = z.object({
  role: z.enum(["client", "braider", "expert"]),
  accepted_terms: z
    .boolean()
    .refine((v) => v === true, "You must accept the Terms and Privacy Policy to continue."),
  marketing_opt_in: z.boolean().default(false),
});
export type CompleteOAuthRegistrationInput = z.infer<typeof completeOAuthRegistrationSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
