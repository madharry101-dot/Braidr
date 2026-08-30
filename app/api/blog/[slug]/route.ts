import { createClient } from "@/lib/supabase/server";
import { hydratePeople } from "@/lib/blog/hydrate";
import { renderMarkdown } from "@/lib/blog/markdown";
import { ok, fail } from "@/lib/api/response";

// GET /api/blog/:slug — one post. Unauthenticated for published posts; RLS
// additionally lets an author (and staff) fetch their own unpublished work,
// which is what makes the editor's preview work without a second endpoint.
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("blog_posts")
    .select("id, title, slug, body, excerpt, category, status, published_at, author_id")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!post) return fail("NOT_FOUND", "Post not found.", 404);

  const people = await hydratePeople([post.author_id]);
  const author = people.get(post.author_id);

  return ok({
    post: {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      category: post.category,
      status: post.status,
      published_at: post.published_at,
      author_name: author?.name ?? "Braidr",
      author_credentials: author?.credentials ?? null,
      body_html: renderMarkdown(post.body),
    },
  });
}
