import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validate } from "@/lib/api/validate";
import { updateBlogPostSchema } from "@/lib/validations/blog";
import { isAdmin } from "@/lib/auth/require-admin";
import { renderMarkdown } from "@/lib/blog/markdown";
import { hydratePeople } from "@/lib/blog/hydrate";
import { ok, fail } from "@/lib/api/response";

// GET /api/blog/posts/:id — the editing view of one post (by id, not slug),
// including its workflow state. RLS scopes this to the author and staff.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!post) return fail("NOT_FOUND", "Post not found.", 404);

  const people = await hydratePeople([post.author_id, post.reviewed_by ?? ""]);

  return ok({
    post: {
      ...post,
      author_name: people.get(post.author_id)?.name ?? "Unknown",
      reviewer_name: post.reviewed_by ? (people.get(post.reviewed_by)?.name ?? null) : null,
      body_html: renderMarkdown(post.body),
      is_author: post.author_id === user.id,
    },
  });
}

// PUT /api/blog/posts/:id — edit. An author may edit their own post while
// it is unpublished (RLS enforces both halves). An admin may edit anything,
// including a published post, via the service-role client.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const parsed = validate(updateBlogPostSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  if (Object.keys(parsed.data).length === 0) return ok({ updated: false });

  const admin = await isAdmin(supabase, user.id);
  const client = admin ? createAdminClient() : supabase;

  const { data: updated, error } = await client
    .from("blog_posts")
    .update(parsed.data)
    .eq("id", params.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[blog] update failed", error);
    return fail("INTERNAL_ERROR", "Couldn't save the post.", 500);
  }
  if (!updated) {
    return fail("FORBIDDEN", "You can't edit this post.", 403);
  }
  return ok({ updated: true });
}

// DELETE /api/blog/posts/:id — authors can delete their own drafts (RLS);
// admins can delete anything.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const admin = await isAdmin(supabase, user.id);
  const client = admin ? createAdminClient() : supabase;

  const { data: deleted, error } = await client
    .from("blog_posts")
    .delete()
    .eq("id", params.id)
    .select("id")
    .maybeSingle();

  if (error) return fail("INTERNAL_ERROR", "Couldn't delete the post.", 500);
  if (!deleted) return fail("FORBIDDEN", "You can't delete this post.", 403);
  return ok({ deleted: true });
}
