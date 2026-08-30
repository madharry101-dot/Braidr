import { z } from "zod";
import { HAIR_TEXTURES } from "@/lib/hair/textures";

export const braiderSearchSchema = z.object({
  city: z.string().trim().optional(),
  category: z.enum(["braids", "locs", "cornrows", "twists", "other"]).optional(),
  style: z.string().trim().optional(), // matched against specialisations[]
  // Plain-language hair texture (Part 1). Filters to braiders VERIFIED for
  // that texture — see the search route.
  texture: z.enum(HAIR_TEXTURES).optional(),
  price_max_pence: z.coerce.number().int().positive().optional(),
  braidcare_only: z.coerce.boolean().optional(),
  verified_only: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// PUT /api/braiders/me/textures — the full set of textures the braider
// declares. The route diffs this against existing rows.
export const setTextureSpecialisationsSchema = z.object({
  textures: z.array(z.enum(HAIR_TEXTURES)).max(4),
});
export type SetTextureSpecialisationsInput = z.infer<typeof setTextureSpecialisationsSchema>;
export type BraiderSearchInput = z.infer<typeof braiderSearchSchema>;

export const updateBraiderProfileSchema = z.object({
  bio: z.string().trim().max(2000).optional(),
  specialisations: z.array(z.string().trim().min(1)).max(20).optional(),
  city: z.string().trim().min(1).optional(),
  area: z.string().trim().max(200).optional(),
  years_experience: z.number().int().min(0).max(80).optional(),
});
export type UpdateBraiderProfileInput = z.infer<typeof updateBraiderProfileSchema>;

// Creating the braider_profiles row (POST /api/braiders/me). city is the
// one required field (matches the table NOT NULL); everything else can be
// filled in later on the profile screen before the braider goes live.
export const createBraiderProfileSchema = z.object({
  city: z.string().trim().min(1, "City is required."),
  area: z.string().trim().max(200).optional(),
  bio: z.string().trim().max(2000).optional(),
  specialisations: z.array(z.string().trim().min(1)).max(20).optional(),
  years_experience: z.number().int().min(0).max(80).optional(),
});
export type CreateBraiderProfileInput = z.infer<typeof createBraiderProfileSchema>;

export const createServiceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.enum(["braids", "locs", "cornrows", "twists", "other"]),
  price_from: z.number().int().positive(),
  price_to: z.number().int().positive().optional(),
  duration_mins: z.number().int().min(15).max(720),
  description: z.string().trim().max(2000).optional(),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial().extend({
  is_active: z.boolean().optional(),
});
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM");

export const setAvailabilityRulesSchema = z.object({
  rules: z
    .array(
      z.object({
        day_of_week: z.number().int().min(0).max(6),
        start_time: timeString,
        end_time: timeString,
      })
    )
    .max(50),
});
export type SetAvailabilityRulesInput = z.infer<typeof setAvailabilityRulesSchema>;

export const blockDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  reason: z.string().trim().max(200).optional(),
});
export type BlockDateInput = z.infer<typeof blockDateSchema>;

export const getAvailabilitySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  service_id: z.string().uuid(),
});
export type GetAvailabilityInput = z.infer<typeof getAvailabilitySchema>;
