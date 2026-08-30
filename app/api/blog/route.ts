import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validate } from "@/lib/api/validate";
import { createBlogPostSchema, listBlogPostsSchema } from "@/lib/validations/blog";
import { hydratePeople } from "@/lib/blog/hydrate";
import { slugify } from "@/lib/blog/markdown";
import { ok, fail } from "@/lib/api/response";

// GET /api/blog — published posts, optionally filtered by category.
// Deliberately unauthenticated: the content hub is free to read, no
// account needed (blog_posts_public_read_published covers the anon role).
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const parsed = validate(listBlogPostsSchema, Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.ok) return parsed.response;
  const { category, limit } = parsed.data;

  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, category, published_at, author_id")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (category) query = query.eq("category", category);

  const { data: posts, error } = await query;
  if (error) return fail("INTERNAL_ERROR", "Couldn't load posts.", 500);

  const people = await hydratePeople(
    supabase,
    (posts ?? []).map((p) => p.author_id)
  );

  return ok({
    posts: (posts ?? []).map(({ author_id, ...p }) => ({
      ...p,
      author_name: people.get(author_id)?.name ?? "Braidr",
      author_credentials: people.get(author_id)?.credentials ?? null,
    })),
  });
}

// POST /api/blog — create a draft. Admins and dermatologist advisors only.
// Always lands as a draft (DB trigger enforces it); there is no way to
// create something already published.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "expert") {
    return fail("FORBIDDEN", "Only admins and advisors can write posts.", 403);
  }

  const parsed = validate(createBlogPostSchema, await request.json());
  if (!parsed.ok) return parsed.response;
  const { title, body, excerpt, category } = parsed.data;

  const baseSlug = parsed.data.slug ?? slugify(title);
  if (!baseSlug) {
    return fail("VALIDATION_ERROR", "Couldn't build a URL from that title.", 422, "title");
  }

  // Slugs are unique. Try the base, then -2, -3… rather than failing back to
  // the author over something we can resolve.
  let slug = baseSlug;
  for (let attempt = 2; attempt <= 20; attempt++) {
    const { data: clash } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${attempt}`;
  }

  const { data: created, error } = await supabase
    .from("blog_posts")
    .insert({ title, slug, body, excerpt, category, author_id: user.id })
    .select("id, slug")
    .single();

  if (error || !created) {
    console.error("[blog] create failed", error);
    return fail("INTERNAL_ERROR", "Couldn't create the post.", 500);
  }
  return ok({ id: created.id, slug: created.slug, status: "draft" }, 201);
}
