import { z } from "zod";
import { HAIR_TEXTURES } from "@/lib/hair/textures";

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

// POST /api/bookings/:id/confirm-hair-type — the braider's post-appointment
// confirmation. "Prefer not to say" isn't offered: that's a client privacy
// choice, not an observation a braider can make on their behalf.
export const confirmHairTypeSchema = z.object({
  hair_type: z.enum(HAIR_TEXTURES),
});
export type ConfirmHairTypeInput = z.infer<typeof confirmHairTypeSchema>;
