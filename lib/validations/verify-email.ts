import { z } from "zod";

// Matches the params Supabase puts on its email-confirmation redirect link.
export const verifyEmailSchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(["email", "signup", "invite", "recovery", "email_change"]),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
