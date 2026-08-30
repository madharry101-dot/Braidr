"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { BlogCategory, BlogPostAdminRow, BlogStatus } from "@/lib/blog/types";

export type BlogWorkflowFilters = {
  status?: BlogStatus;
  category?: BlogCategory;
  author?: string;
};

export type BlogWorkflowRow = BlogPostAdminRow & { can_review: boolean };

export function useBlogWorkflow(filters: BlogWorkflowFilters) {
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  if (filters.category) qs.set("category", filters.category);
  if (filters.author) qs.set("author", filters.author);
  const query = qs.toString();

  return useQuery({
    queryKey: ["blog", "workflow", query],
    queryFn: () => api.get<{ posts: BlogWorkflowRow[] }>(`/blog/posts${query ? `?${query}` : ""}`),
    select: (d) => d.posts,
  });
}

export type BlogPostEditable = BlogPostAdminRow & {
  body: string;
  body_html: string;
  is_author: boolean;
};

export function useBlogPost(id: string) {
  return useQuery({
    queryKey: ["blog", "post", id],
    queryFn: () => api.get<{ post: BlogPostEditable }>(`/blog/posts/${id}`),
    select: (d) => d.post,
    enabled: Boolean(id),
  });
}

function useInvalidateBlog() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["blog"] });
}

export type BlogPostInput = {
  title: string;
  body: string;
  excerpt: string;
  category: BlogCategory;
};

export function useCreateBlogPost() {
  const invalidate = useInvalidateBlog();
  return useMutation({
    mutationFn: (input: BlogPostInput) => api.post<{ id: string; slug: string }>("/blog", input),
    onSuccess: invalidate,
  });
}

export function useUpdateBlogPost(id: string) {
  const invalidate = useInvalidateBlog();
  return useMutation({
    mutationFn: (input: Partial<BlogPostInput>) =>
      api.put<{ updated: boolean }>(`/blog/posts/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useSubmitBlogPost(id: string) {
  const invalidate = useInvalidateBlog();
  return useMutation({
    mutationFn: (action: "submit_for_review" | "withdraw_to_draft") =>
      api.post<{ status: BlogStatus }>(`/blog/posts/${id}/submit`, { action }),
    onSuccess: invalidate,
  });
}

export function useReviewBlogPost(id: string) {
  const invalidate = useInvalidateBlog();
  return useMutation({
    mutationFn: (input: { action: "approve" | "request_changes"; note?: string }) =>
      api.post<{ status: BlogStatus }>(`/blog/posts/${id}/review`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteBlogPost() {
  const invalidate = useInvalidateBlog();
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: boolean }>(`/blog/posts/${id}`),
    onSuccess: invalidate,
  });
}
