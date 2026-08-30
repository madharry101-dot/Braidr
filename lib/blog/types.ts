export const BLOG_CATEGORIES = ["educational", "health_safety", "expert_content"] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export const BLOG_STATUSES = ["draft", "in_review", "published"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export const BLOG_CATEGORY_META: Record<BlogCategory, { label: string; blurb: string }> = {
  educational: {
    label: "Education",
    blurb: "How braiding, hair and scalp care work.",
  },
  health_safety: {
    label: "Health & safety",
    blurb: "Looking after your scalp and knowing when to get something looked at.",
  },
  expert_content: {
    label: "From our advisors",
    blurb: "Written by the dermatologists who advise Braidr.",
  },
};

export const BLOG_STATUS_META: Record<
  BlogStatus,
  { label: string; tone: "neutral" | "warning" | "braidcare" }
> = {
  draft: { label: "Draft", tone: "neutral" },
  in_review: { label: "In review", tone: "warning" },
  published: { label: "Published", tone: "braidcare" },
};

/** Public shape — what a reader sees. */
export type BlogPostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: BlogCategory;
  published_at: string | null;
  author_name: string;
  /** Advisor credential line, e.g. "Consultant Dermatologist, MRCP". Null for staff authors. */
  author_credentials: string | null;
};

export type BlogPostDetail = BlogPostSummary & {
  /** Sanitised HTML, already rendered from the stored Markdown. */
  body_html: string;
};

/** Author/admin shape — adds workflow state. */
export type BlogPostAdminRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: BlogCategory;
  status: BlogStatus;
  author_id: string;
  author_name: string;
  reviewed_by: string | null;
  reviewer_name: string | null;
  review_note: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
