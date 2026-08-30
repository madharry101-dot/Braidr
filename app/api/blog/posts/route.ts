import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hydratePeople } from "@/lib/blog/hydrate";
import { BLOG_CATEGORIES, BLOG_STATUSES } from "@/lib/blog/types";
import { ok, fail } from "@/lib/api/response";

// GET /api/blog/posts — the workflow list. Admins see every post; advisors
// see their own plus anything awaiting review (they're eligible reviewers).
// Filters: status, author, category.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Not signed in.", 401);

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin" && me?.role !== "expert") {
    return fail("FORBIDDEN", "Only admins and advisors can see the post list.", 403);
  }
  const admin = me.role === "admin";

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status");
  const category = sp.get("category");
  const author = sp.get("author");

  // Admins read through the service-role client so the list is genuinely
  // "all posts regardless of status"; advisors go through RLS, which
  // already scopes them to their own work plus the shared staff read.
  const client = admin ? createAdminClient() : supabase;
  let query = client
    .from("blog_posts")
    .select(
      "id, title, slug, excerpt, category, status, author_id, reviewed_by, review_note, published_at, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  const validStatus = BLOG_STATUSES.find((s) => s === status);
  const validCategory = BLOG_CATEGORIES.find((c) => c === category);
  if (validStatus) query = query.eq("status", validStatus);
  if (validCategory) query = query.eq("category", validCategory);
  if (author) query = query.eq("author_id", author);

  const { data: posts, error } = await query;
  if (error) {
    console.error("[blog] list failed", error);
    return fail("INTERNAL_ERROR", "Couldn't load posts.", 500);
  }

  const people = await hydratePeople([
    ...(posts ?? []).map((p) => p.author_id),
    ...(posts ?? []).map((p) => p.reviewed_by ?? ""),
  ]);

  return ok({
    posts: (posts ?? []).map((p) => ({
      ...p,
      author_name: people.get(p.author_id)?.name ?? "Unknown",
      reviewer_name: p.reviewed_by ? (people.get(p.reviewed_by)?.name ?? null) : null,
      // An advisor can't clear their own work, so the UI shouldn't offer it.
      can_review: p.status === "in_review" && p.author_id !== user.id,
    })),
  });
}
