import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import { hydratePeople } from "@/lib/blog/hydrate";
import { CategoryFilter } from "@/components/blog/category-filter";
import { BLOG_CATEGORIES, BLOG_CATEGORY_META, type BlogCategory } from "@/lib/blog/types";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Hair and scalp health",
  description:
    "Free education on braiding, hair and scalp care — including guidance written by the dermatologists who advise Braidr.",
};

// Server component: the blog is public and should be crawlable, so it
// renders on the server against RLS (published posts are readable by the
// anon role) rather than fetching from the client.
//
// Statically generated and revalidated every 5 minutes. Two things keep it
// that way, and breaking either one silently returns this page to querying
// Supabase on every request:
//
//   - `createPublicClient()`, not `createClient()` from lib/supabase/server.
//     The latter reads cookies, which forces dynamic rendering. Nothing here
//     varies by session anyway: the query pins `status = 'published'`, so an
//     admin sees the same list as an anonymous visitor.
//   - No `searchParams`. The ?category= filter is applied in the browser by
//     <CategoryFilter>; reading searchParams here would force dynamic
//     rendering regardless of which Supabase client is used.
//
// 300s is a backstop rather than the mechanism: publishing a post calls
// revalidatePath from the review route, so new articles appear immediately.
export const revalidate = 300;

export default async function BlogIndex() {
  const supabase = createPublicClient();

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, category, published_at, author_id")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  // Bylines come from the service-role client (see lib/blog/hydrate.ts) and
  // get baked into the cached HTML. Safe only because hydratePeople returns
  // a name and a credential and nothing else — the rest of a profiles row
  // has no business in a page served to everyone.
  const people = await hydratePeople((posts ?? []).map((p) => p.author_id));

  // Counts let the filter say "no articles in this category" without having
  // to know what is inside the list it is wrapping.
  const counts = Object.fromEntries(
    BLOG_CATEGORIES.map((c) => [c, (posts ?? []).filter((p) => p.category === c).length])
  ) as Record<BlogCategory, number>;

  return (
    <div>
      <h1 className="br-display text-3xl text-plum sm:text-4xl">Hair and scalp health</h1>
      <p className="mt-2 max-w-2xl text-slate">
        Free, practical guidance on braiding, hair and scalp care — including articles written by
        the dermatologists who advise Braidr. This is general education, not medical advice: if
        something about your scalp concerns you, speak to a scalp health specialist or your GP.
      </p>

      {(posts ?? []).length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
          <p className="font-medium text-plum">Nothing here yet</p>
          <p className="mt-1 text-sm text-slate">The first articles are on their way.</p>
        </div>
      ) : (
        <CategoryFilter counts={counts}>
          <ul data-blog-list className="mt-8 flex flex-col gap-6">
            {(posts ?? []).map((post) => {
              const author = people.get(post.author_id);
              return (
                <li
                  key={post.id}
                  data-category={post.category}
                  className="border-b border-mist pb-6 last:border-0"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-teal-deep">
                    {BLOG_CATEGORY_META[post.category].label}
                  </p>
                  <h2 className="mt-1 font-display text-xl text-plum">
                    <Link href={`/blog/${post.slug}`} className="hover:text-teal-deep">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-1.5 text-slate">{post.excerpt}</p>
                  <p className="mt-2 text-sm text-slate">
                    {author?.name ?? "Braidr"}
                    {author?.credentials ? `, ${author.credentials}` : ""}
                    {post.published_at ? ` · ${formatDate(post.published_at)}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </CategoryFilter>
      )}
    </div>
  );
}
