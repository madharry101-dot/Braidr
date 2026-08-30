import { z } from "zod";
import { BLOG_CATEGORIES } from "@/lib/blog/types";

export const createBlogPostSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(1).max(100_000),
  excerpt: z.string().trim().min(1).max(400),
  category: z.enum(BLOG_CATEGORIES),
  // Optional — derived from the title when absent.
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens.")
    .max(80)
    .optional(),
});
export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;

export const updateBlogPostSchema = createBlogPostSchema.partial();
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;

// Author action: send a draft for review, or pull it back to draft.
export const submitBlogPostSchema = z.object({
  action: z.enum(["submit_for_review", "withdraw_to_draft"]),
});
export type SubmitBlogPostInput = z.infer<typeof submitBlogPostSchema>;

// Reviewer action. "request_changes" carries a note back to the author.
export const reviewBlogPostSchema = z
  .object({
    action: z.enum(["approve", "request_changes"]),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.action !== "request_changes" || (v.note?.length ?? 0) > 0, {
    message: "Tell the author what needs changing.",
    path: ["note"],
  });
export type ReviewBlogPostInput = z.infer<typeof reviewBlogPostSchema>;

export const listBlogPostsSchema = z.object({
  category: z.enum(BLOG_CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
