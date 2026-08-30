"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { LoadingBlock } from "@/components/ui/spinner";
import { PostEditor } from "@/components/blog/post-editor";
import {
  useBlogPost,
  useUpdateBlogPost,
  useSubmitBlogPost,
  useReviewBlogPost,
  useDeleteBlogPost,
} from "@/lib/hooks/blog";
import { ApiError } from "@/lib/api/client";
import { BLOG_STATUS_META } from "@/lib/blog/types";
import { formatDate } from "@/lib/format";

// One post: edit it, move it through the workflow, or review someone
// else's. Which controls appear is driven by the post's own state and
// whether the viewer is its author — the API and DB enforce the same rules
// again, so this is convenience, not security.

export function PostWorkspace({ id, basePath }: { id: string; basePath: string }) {
  const router = useRouter();
  const { data: post, isLoading, isError } = useBlogPost(id);
  const update = useUpdateBlogPost(id);
  const submit = useSubmitBlogPost(id);
  const review = useReviewBlogPost(id);
  const remove = useDeleteBlogPost();

  const [note, setNote] = useState("");
  const [showChanges, setShowChanges] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <LoadingBlock label="Loading post" />;
  if (isError || !post) return <Alert tone="error">This post could not be loaded.</Alert>;

  const canEdit = post.is_author ? post.status !== "published" : true;

  async function run(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={basePath} className="text-sm text-teal-deep hover:text-plum">
          ← All posts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl text-plum">{post.title}</h1>
          <Badge tone={BLOG_STATUS_META[post.status].tone}>
            {BLOG_STATUS_META[post.status].label}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate">
          By {post.author_name}
          {post.published_at ? ` · published ${formatDate(post.published_at)}` : ""}
          {post.status === "published" && (
            <>
              {" · "}
              <Link href={`/blog/${post.slug}`} className="text-teal-deep underline">
                View live
              </Link>
            </>
          )}
        </p>
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      {post.status === "draft" && post.review_note && (
        <Alert tone="error">
          <b className="font-medium">Changes requested</b>
          {post.reviewer_name ? ` by ${post.reviewer_name}` : ""}: {post.review_note}
        </Alert>
      )}

      {/* Review panel — only ever rendered for someone who isn't the author. */}
      {post.status === "in_review" && !post.is_author && (
        <Card>
          <CardTitle className="text-lg">Review</CardTitle>
          <p className="mt-1 text-sm text-slate">
            Check the language is observational rather than diagnostic before approving. Approving
            publishes it immediately.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="sm:!w-auto"
              loading={review.isPending}
              onClick={() => run(() => review.mutateAsync({ action: "approve" }))}
            >
              Approve &amp; publish
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="sm:!w-auto"
              onClick={() => setShowChanges((v) => !v)}
            >
              Request changes
            </Button>
          </div>
          {showChanges && (
            <div className="mt-4">
              <label htmlFor="review-note" className="text-sm font-medium text-plum">
                What needs changing?
              </label>
              <textarea
                id="review-note"
                rows={3}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1.5 w-full rounded border border-mist bg-white px-3 py-2 text-plum focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              />
              <Button
                size="sm"
                variant="danger"
                className="mt-2 sm:!w-auto"
                disabled={!note.trim()}
                loading={review.isPending}
                onClick={() =>
                  run(async () => {
                    await review.mutateAsync({ action: "request_changes", note: note.trim() });
                    setShowChanges(false);
                    setNote("");
                  })
                }
              >
                Send back to draft
              </Button>
            </div>
          )}
        </Card>
      )}

      {post.status === "in_review" && post.is_author && (
        <Alert tone="info">
          This post is waiting for review. You can&rsquo;t clear your own work — an admin or another
          advisor has to. You can pull it back to draft if you want to keep editing.
        </Alert>
      )}

      {/* Author workflow actions. */}
      {post.is_author && (post.status === "draft" || post.status === "in_review") && (
        <div className="flex flex-wrap gap-2">
          {post.status === "draft" ? (
            <Button
              size="sm"
              className="sm:!w-auto"
              loading={submit.isPending}
              onClick={() => run(() => submit.mutateAsync("submit_for_review"))}
            >
              Submit for review
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="sm:!w-auto"
              loading={submit.isPending}
              onClick={() => run(() => submit.mutateAsync("withdraw_to_draft"))}
            >
              Pull back to draft
            </Button>
          )}
          {post.status === "draft" && (
            <Button
              size="sm"
              variant="ghost"
              className="sm:!w-auto"
              loading={remove.isPending}
              onClick={() =>
                run(async () => {
                  await remove.mutateAsync(post.id);
                  router.push(basePath);
                })
              }
            >
              Delete draft
            </Button>
          )}
        </div>
      )}

      {canEdit ? (
        <PostEditor
          initial={{
            title: post.title,
            excerpt: post.excerpt,
            body: post.body,
            category: post.category,
          }}
          submitLabel="Save changes"
          pending={update.isPending}
          onSubmit={(input) => update.mutateAsync(input)}
        />
      ) : (
        <Card>
          <CardTitle className="text-lg">Body</CardTitle>
          <div className="blog-body mt-4" dangerouslySetInnerHTML={{ __html: post.body_html }} />
        </Card>
      )}
    </div>
  );
}
