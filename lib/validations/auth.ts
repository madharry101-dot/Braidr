import { z } from "zod";

// PRD FR-AUTH-01.4: role selection at registration determines dashboard and
// permissions. Admin accounts are never self-registered.
export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  full_name: z.string().trim().min(1, "Full name is required.").max(200),
  role: z.enum(["client", "braider", "expert"]),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
