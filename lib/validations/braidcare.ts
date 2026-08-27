import { z } from "zod";

export const initiateSessionSchema = z.object({
  booking_id: z.string().uuid(),
});
export type InitiateSessionInput = z.infer<typeof initiateSessionSchema>;

export const purchaseSchema = z.object({
  booking_id: z.string().uuid(),
  type: z.enum(["oneoff", "subscription"]),
});
export type PurchaseInput = z.infer<typeof purchaseSchema>;
