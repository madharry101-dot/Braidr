import { z } from "zod";

export const removeContentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
export type RemoveContentInput = z.infer<typeof removeContentSchema>;

export const announcementSchema = z.object({
  segment: z.object({
    role: z.enum(["client", "braider", "expert"]).optional(),
    city: z.string().trim().optional(),
    braidr_pro_subscribed: z.boolean().optional(), // braiders only
    braidcare_client_subscribed: z.boolean().optional(), // clients only
  }),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;
