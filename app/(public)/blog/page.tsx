import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hydratePeople } from "@/lib/blog/hydrate";
import { BLOG_CATEGORIES, BLOG_CATEGORY_META, type BlogCategory } from "@/lib/blog/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Hair and scalp health",
  description:
    "Free education on braiding, hair and scalp care — including guidance written by the dermatologists who advise Braidr.",
};

// Server component: the blog is public and should be crawlable, so it
// renders on the server against RLS (published posts are readable by the
// anon role) rather than fetching from the client.
export const revalidate = 300;

export default async function BlogIndex({ searchParams }: { searchParams: { category?: string } }) {
  const supabase = await createClient();

  const active = (BLOG_CATEGORIES as readonly string[]).includes(searchParams.category ?? "")
    ? (searchParams.category as BlogCategory)
    : null;

  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, excerpt, category, published_at, author_id")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);
  if (active) query = query.eq("category", active);

  const { data: posts } = await query;
  const people = await hydratePeople((posts ?? []).map((p) => p.author_id));

  return (
    <div>
      <h1 className="br-display text-3xl text-plum sm:text-4xl">Hair and scalp health</h1>
      <p className="mt-2 max-w-2xl text-slate">
        Free, practical guidance on braiding, hair and scalp care — including articles written by
        the dermatologists who advise Braidr. This is general education, not medical advice: if
        something about your scalp concerns you, speak to a scalp health specialist or your GP.
      </p>

      <nav aria-label="Filter by category" className="mt-6 flex flex-wrap gap-2">
        <CategoryLink href="/blog" active={active === null} label="All" />
        {BLOG_CATEGORIES.map((c) => (
          <CategoryLink
            key={c}
            href={`/blog?category=${c}`}
            active={active === c}
            label={BLOG_CATEGORY_META[c].label}
          />
        ))}
      </nav>

      {active && <p className="mt-3 text-sm text-slate">{BLOG_CATEGORY_META[active].blurb}</p>}

      {(posts ?? []).length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
          <p className="font-medium text-plum">Nothing here yet</p>
          <p className="mt-1 text-sm text-slate">
            {active
              ? "No articles in this category so far."
              : "The first articles are on their way."}
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-6">
          {(posts ?? []).map((post) => {
            const author = people.get(post.author_id);
            return (
              <li key={post.id} className="border-b border-mist pb-6 last:border-0">
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
      )}
    </div>
  );
}

function CategoryLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm",
        active ? "bg-plum text-white" : "border border-mist bg-white text-slate hover:border-teal"
      )}
    >
      {label}
    </Link>
  );
}
