import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { submitBlogPostSchema } from "@/lib/validations/blog";
import { ok, fail } from "@/lib/api/response";

// POST /api/blog/posts/:id/submit — the author moves their own draft into
// review, or pulls it back out. This is the only status change an author
// can make: 'published' is unreachable from here (the DB trigger rejects
// draft -> published, and the no-self-review constraint blocks an author
// naming themselves as reviewer), so an advisor cannot self-publish even
// if this route were compromised.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(submitBlogPostSchema, await request.json());
  if (!parsed.ok) return parsed.response;

  const { data: post } = await supabase
    .from("blog_posts")
    .select("id, author_id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (!post) return fail("NOT_FOUND", "Post not found.", 404);
  if (post.author_id !== user.id) {
    return fail("FORBIDDEN", "Only the author can submit this post.", 403);
  }

  const submitting = parsed.data.action === "submit_for_review";
  const expected = submitting ? "draft" : "in_review";
  if (post.status !== expected) {
    return fail(
      "VALIDATION_ERROR",
      submitting
        ? "Only a draft can be sent for review."
        : "Only a post in review can be pulled back to draft.",
      409
    );
  }

  const { error } = await supabase
    .from("blog_posts")
    .update({
      status: submitting ? "in_review" : "draft",
      // Submitting again clears the previous round's note so the author
      // isn't left staring at stale feedback.
      ...(submitting ? { review_note: null } : {}),
    })
    .eq("id", params.id);

  if (error) {
    console.error("[blog] submit failed", error);
    return fail("INTERNAL_ERROR", "Couldn't update the post.", 500);
  }
  return ok({ status: submitting ? "in_review" : "draft" });
}
