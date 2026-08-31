import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { reviewBlogPostSchema } from "@/lib/validations/blog";
import { enqueueNewsletterForPost } from "@/lib/newsletter/enqueue";
import { ok, fail } from "@/lib/api/response";

// POST /api/blog/posts/:id/review — approve (-> published) or request
// changes (-> draft, with a note).
//
// Who may review: an admin, or another dermatologist advisor. Never the
// author, whoever they are — that rule is the point of this checkpoint, and
// it is enforced three deep: here, by the blog_posts_no_self_review table
// constraint, and by the status trigger that only allows in_review ->
// published.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "expert") {
    return fail("FORBIDDEN", "Only admins and advisors can review posts.", 403);
  }

  const parsed = validate(reviewBlogPostSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const admin = createAdminClient();
  const { data: post } = await admin
    .from("blog_posts")
    .select("id, author_id, status, title")
    .eq("id", params.id)
    .maybeSingle();
  if (!post) return fail("NOT_FOUND", "Post not found.", 404);

  if (post.author_id === user.id) {
    return fail(
      "FORBIDDEN",
      "You can't review your own post. Another admin or advisor has to clear it.",
      403
    );
  }
  if (post.status !== "in_review") {
    return fail("VALIDATION_ERROR", "This post isn't awaiting review.", 409);
  }

  const now = new Date().toISOString();

  if (parsed.data.action === "request_changes") {
    const { error } = await admin
      .from("blog_posts")
      .update({
        status: "draft",
        review_note: parsed.data.note ?? null,
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("id", params.id);
    if (error) {
      console.error("[blog] request_changes failed", error);
      return fail("INTERNAL_ERROR", "Couldn't send the post back.", 500);
    }
    return ok({ status: "draft" });
  }

  const { error } = await admin
    .from("blog_posts")
    .update({
      status: "published",
      published_at: now,
      reviewed_by: user.id,
      reviewed_at: now,
      review_note: null,
    })
    .eq("id", params.id);
  if (error) {
    console.error("[blog] publish failed", error);
    return fail("INTERNAL_ERROR", "Couldn't publish the post.", 500);
  }

  // Queue the newsletter rather than sending it here — publishing stays
  // instant and can't fail because an email provider is struggling. The
  // cron drains it. Idempotent, so a republish won't double-send.
  const { queued } = await enqueueNewsletterForPost(admin, params.id);

  return ok({ status: "published", published_at: now, newsletter_queued: queued });
}
