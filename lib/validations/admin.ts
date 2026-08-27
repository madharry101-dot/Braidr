import { z } from "zod";

export const listUsersSchema = z.object({
  role: z.enum(["client", "braider", "expert", "admin"]).optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListUsersInput = z.infer<typeof listUsersSchema>;

export const suspendUserSchema = z.object({
  suspended: z.boolean(),
});
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

export const verifyBraiderSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});
export type VerifyBraiderInput = z.infer<typeof verifyBraiderSchema>;

export const raiseDisputeSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type RaiseDisputeInput = z.infer<typeof raiseDisputeSchema>;

export const resolveDisputeSchema = z.object({
  resolution: z.enum(["refund", "dismiss"]),
  refund_pence: z.number().int().min(1).optional(),
  note: z.string().trim().max(1000),
});
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
