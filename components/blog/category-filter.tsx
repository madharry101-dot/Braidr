"use client";

import { useEffect, useState } from "react";
import { BLOG_CATEGORIES, BLOG_CATEGORY_META, type BlogCategory } from "@/lib/blog/types";
import { cn } from "@/lib/cn";

// Category filtering for /blog, deliberately client-side.
//
// The page it lives on is statically generated and revalidated (ISR), which
// it can only be if it never reads `searchParams` — reading them opts the
// route into per-request rendering, which is exactly what we are trying to
// stop. So the server renders every published post and this narrows the view
// in the browser.
//
// Two things this does NOT do, both on purpose:
//
// 1. It does not call `useSearchParams()`. In a statically generated page
//    that hook forces a Suspense boundary, and a boundary's *fallback* is
//    what gets baked into the prerendered HTML — which would strip the posts
//    out of the very HTML we are making cacheable so crawlers can read it.
//    The initial category is read once from window.location.search instead.
//
// 2. It does not render the posts. They arrive as `children`, already
//    rendered on the server, so every article is in the static HTML whatever
//    happens in the browser. This component only hides some of them.
//
// The consequence is that filtering needs JavaScript: without it a visitor
// sees all posts rather than a filtered subset. Nothing becomes unreachable,
// which is the bar that matters for a filter.

function parseCategory(value: string | null): BlogCategory | null {
  return (BLOG_CATEGORIES as readonly string[]).includes(value ?? "")
    ? (value as BlogCategory)
    : null;
}

export function CategoryFilter({
  counts,
  children,
}: {
  counts: Record<BlogCategory, number>;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<BlogCategory | null>(null);

  // Deep links (/blog?category=health_safety) and back/forward. Starting at
  // null and correcting on mount means a filtered deep link shows the full
  // list for one frame — the trade for having every post in the static HTML.
  useEffect(() => {
    const sync = () =>
      setActive(parseCategory(new URLSearchParams(window.location.search).get("category")));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  function select(next: BlogCategory | null) {
    setActive(next);
    // replaceState rather than router.replace: the App Router supports the
    // native history API and stays in sync with it, and this way changing
    // the filter costs no RSC round trip at all.
    window.history.replaceState(null, "", next ? `/blog?category=${next}` : "/blog");
  }

  return (
    <>
      <nav aria-label="Filter by category" className="mt-6 flex flex-wrap gap-2">
        <Chip onClick={() => select(null)} active={active === null} label="All" />
        {BLOG_CATEGORIES.map((c) => (
          <Chip
            key={c}
            onClick={() => select(c)}
            active={active === c}
            label={BLOG_CATEGORY_META[c].label}
          />
        ))}
      </nav>

      {active && <p className="mt-3 text-sm text-slate">{BLOG_CATEGORY_META[active].blurb}</p>}

      {/* `active` can only ever be one of BLOG_CATEGORIES (parseCategory
          rejects anything else), so it is safe to interpolate here.

          ⚠️ CSP CONSTRAINT — READ BEFORE TIGHTENING style-src.

          This is an inline <style> element, on pages that previously had
          none. It renders only after hydration, so it is absent from the
          prerendered HTML and will NOT appear in any static scan of the
          markup — the constraint is invisible unless you are looking here.

          It means `style-src 'unsafe-inline'` in the Content-Security-Policy
          (next.config.mjs, R-04) is LOAD-BEARING. Removing that keyword
          silently stops this rule applying, and the category filter goes on
          highlighting the selected chip while showing every post — a wrong
          result that looks like a working page, not an error.

          A nonce does not help: nonces apply to elements the server renders,
          and this element is created in the browser. The clean fix is to not
          need an inline style at all — BLOG_CATEGORIES is a fixed, known-at-
          build-time enum, so one static rule per category in globals.css,
          selected by a data attribute on the wrapper, does the same job with
          no inline style and no CSP concession. That is deliberately NOT done
          here; it is scoped as its own change.

          Also note: the 48-hour CSP report-only window did not exercise these
          pages — blog_posts was empty and the blog was unlaunched — so an
          absence of style-src violations in that data says nothing about this
          block. Treat the blog as unverified by that window, not as clean. */}
      {active && (
        <style>{`[data-blog-list] > li:not([data-category="${active}"]) { display: none; }`}</style>
      )}

      {active && counts[active] === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-mist bg-white/60 p-10 text-center">
          <p className="font-medium text-plum">Nothing here yet</p>
          <p className="mt-1 text-sm text-slate">No articles in this category so far.</p>
        </div>
      ) : null}

      {children}
    </>
  );
}

function Chip({ onClick, active, label }: { onClick: () => void; active: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm",
        active ? "bg-plum text-white" : "border border-mist bg-white text-slate hover:border-teal"
      )}
    >
      {label}
    </button>
  );
}
