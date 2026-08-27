import { z } from "zod";

export const createBookingSchema = z.object({
  braider_id: z.string().uuid(),
  service_id: z.string().uuid(),
  appointment_at: z.string().datetime({ message: "appointment_at must be an ISO 8601 timestamp" }),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const rescheduleBookingSchema = z.object({
  new_appointment_at: z
    .string()
    .datetime({ message: "new_appointment_at must be an ISO 8601 timestamp" }),
});
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
