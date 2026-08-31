import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hydratePeople } from "@/lib/blog/hydrate";
import { renderMarkdown } from "@/lib/blog/markdown";
import { BLOG_CATEGORY_META } from "@/lib/blog/types";
import { formatDate } from "@/lib/format";

async function loadPost(slug: string) {
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("id, title, slug, body, excerpt, category, published_at, author_id, reviewed_by")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!post) return null;

  const people = await hydratePeople([post.author_id]);
  return { post, author: people.get(post.author_id) ?? null };
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const loaded = await loadPost(params.slug);
  if (!loaded) return { title: "Article not found" };
  return {
    title: loaded.post.title,
    description: loaded.post.excerpt,
    openGraph: {
      title: loaded.post.title,
      description: loaded.post.excerpt,
      type: "article",
      publishedTime: loaded.post.published_at ?? undefined,
    },
  };
}

export default async function BlogPostPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const loaded = await loadPost(params.slug);
  if (!loaded) notFound();
  const { post, author } = loaded;

  return (
    <article>
      <Link href="/blog" className="text-sm text-teal-deep hover:text-plum">
        ← All articles
      </Link>

      <p className="mt-6 text-xs font-medium uppercase tracking-wide text-teal-deep">
        {BLOG_CATEGORY_META[post.category].label}
      </p>
      <h1 className="br-display mt-1 text-3xl text-plum sm:text-4xl">{post.title}</h1>

      <p className="mt-3 text-sm text-slate">
        By <span className="text-plum">{author?.name ?? "Braidr"}</span>
        {author?.credentials ? `, ${author.credentials}` : ""}
        {post.published_at ? ` · ${formatDate(post.published_at)}` : ""}
      </p>

      {/* Body is stored as Markdown and rendered through a restricted
          allowlist — escape-first, see lib/blog/markdown.ts. */}
      <div
        className="blog-body mt-8"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
      />

      {/* Same discipline as every BraidCare surface: observational, never
          diagnostic, and always pointing at a real clinician for anything
          that actually worries someone. */}
      <aside className="mt-10 rounded-lg border border-mist bg-white/60 p-4 text-sm text-slate">
        This article is general education, not medical advice, and nothing here diagnoses a
        condition. If something about your hair or scalp concerns you, speak to a scalp health
        specialist or your GP.
      </aside>
    </article>
  );
}
