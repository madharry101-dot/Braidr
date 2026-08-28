import { z } from "zod";

// booking_id is optional: a subscriber can start a standalone session with
// no booking (plan §1.1a). The API + RLS both enforce that only an active
// subscriber may omit it.
export const initiateSessionSchema = z.object({
  booking_id: z.string().uuid().optional(),
});
export type InitiateSessionInput = z.infer<typeof initiateSessionSchema>;
