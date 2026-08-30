import { z } from "zod";
import { HAIR_TEXTURES } from "@/lib/hair/textures";

// PUT /api/settings/profile — the fields any role can edit about itself.
// display_name/phone/city/avatar_url are shared; date_of_birth/hair_type
// are client-only (§4.10.1) but harmless to accept for any role.
export const updateProfileSchema = z.object({
  display_name: z.string().trim().max(80).nullish(),
  phone: z.string().trim().max(30).nullish(),
  city: z.string().trim().max(80).nullish(),
  avatar_url: z.string().trim().url().max(500).nullish(),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .nullish(),
  // Plain-language texture vocabulary (Part 1). null = "not set".
  hair_type: z.enum([...HAIR_TEXTURES, "prefer_not_to_say"]).nullish(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// PUT /api/settings/notifications — a partial map of event key -> enabled.
export const updateNotificationsSchema = z.object({
  preferences: z.record(z.string().max(64), z.boolean()),
});
export type UpdateNotificationsInput = z.infer<typeof updateNotificationsSchema>;

// PUT /api/settings/marketing — the one consent-bearing toggle.
export const updateMarketingSchema = z.object({ opted_in: z.boolean() });
export type UpdateMarketingInput = z.infer<typeof updateMarketingSchema>;
