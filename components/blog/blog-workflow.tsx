"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { useBlogWorkflow, type BlogWorkflowFilters } from "@/lib/hooks/blog";
import {
  BLOG_CATEGORIES,
  BLOG_CATEGORY_META,
  BLOG_STATUSES,
  BLOG_STATUS_META,
  type BlogCategory,
  type BlogStatus,
} from "@/lib/blog/types";
import { formatDate } from "@/lib/format";

// The post list, shared by the admin panel and the advisor dashboard. What
// each role can see is decided server-side by GET /api/blog/posts — admins
// get everything, advisors get their own work plus the review queue — so
// this component doesn't branch on role for data, only for copy.

export function BlogWorkflow({
  basePath,
  audience,
}: {
  basePath: string;
  audience: "admin" | "advisor";
}) {
  const [filters, setFilters] = useState<BlogWorkflowFilters>({});
  const { data: posts, isLoading, isError } = useBlogWorkflow(filters);

  const awaitingReview = (posts ?? []).filter((p) => p.can_review).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={audience === "admin" ? "Blog" : "Your articles"}
        subtitle={
          audience === "admin"
            ? "Every post, at every stage. Nothing publishes without a second pair of eyes."
            : "Write and submit articles. Another advisor or an admin clears them for publishing."
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <LinkButton href={`${basePath}/new`} size="sm" className="sm:!w-auto">
          New post
        </LinkButton>
        <Select
          label="Status"
          value={filters.status ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: (e.target.value || undefined) as BlogStatus }))
          }
        >
          <option value="">Any status</option>
          {BLOG_STATUSES.map((s) => (
            <option key={s} value={s}>
              {BLOG_STATUS_META[s].label}
            </option>
          ))}
        </Select>
        <Select
          label="Category"
          value={filters.category ?? ""}
          onChange={(e) =>
            setFilters((f) => ({ ...f, category: (e.target.value || undefined) as BlogCategory }))
          }
        >
          <option value="">Any category</option>
          {BLOG_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {BLOG_CATEGORY_META[c].label}
            </option>
          ))}
        </Select>
      </div>

      {awaitingReview > 0 && (
        <Alert tone="info">
          {awaitingReview} post{awaitingReview === 1 ? "" : "s"} waiting for your review.
        </Alert>
      )}

      {isLoading && <LoadingBlock label="Loading posts" />}
      {isError && <Alert tone="error">Couldn&rsquo;t load posts.</Alert>}

      {posts && posts.length === 0 && (
        <div className="rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
          <p className="font-medium text-plum">No posts yet</p>
          <p className="mt-1 text-sm text-slate">Start with &ldquo;New post&rdquo; above.</p>
        </div>
      )}

      {posts && posts.length > 0 && (
        <ul className="flex flex-col gap-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`${basePath}/${p.id}`}>
                <Card className="transition-shadow hover:shadow-[0_2px_4px_rgba(45,27,53,0.1),0_8px_24px_rgba(45,27,53,0.1)]">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium text-plum">{p.title}</h3>
                      <p className="mt-0.5 text-sm text-slate">
                        {BLOG_CATEGORY_META[p.category].label} · {p.author_name}
                        {p.published_at
                          ? ` · published ${formatDate(p.published_at)}`
                          : ` · updated ${formatDate(p.updated_at)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {p.can_review && <Badge tone="verified">Needs your review</Badge>}
                      <Badge tone={BLOG_STATUS_META[p.status].tone}>
                        {BLOG_STATUS_META[p.status].label}
                      </Badge>
                    </div>
                  </div>
                  {p.status === "draft" && p.review_note && (
                    <p className="mt-2 text-sm text-gold-deep">
                      Changes requested{p.reviewer_name ? ` by ${p.reviewer_name}` : ""}:{" "}
                      {p.review_note}
                    </p>
                  )}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
