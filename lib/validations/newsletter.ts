import { z } from "zod";

// PUT /api/newsletter/subscribe. `subscribed` is explicit rather than a
// toggle so a replayed or duplicated request is idempotent — it sets a
// state, it doesn't flip one.
export const subscribeNewsletterSchema = z.object({
  subscribed: z.boolean(),
  consent_source: z
    .enum(["settings_page", "blog_signup_form", "registration"])
    .default("settings_page"),
});
export type SubscribeNewsletterInput = z.infer<typeof subscribeNewsletterSchema>;

export const unsubscribeTokenSchema = z.object({
  token: z.string().trim().min(16).max(128),
});
