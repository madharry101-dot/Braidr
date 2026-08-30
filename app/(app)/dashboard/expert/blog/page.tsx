import { BlogWorkflow } from "@/components/blog/blog-workflow";

// Advisors reach the same workflow from their own dashboard — /admin is
// role-gated to admins in middleware, so this is the advisor mount point.
export default function ExpertBlogPage() {
  return <BlogWorkflow basePath="/dashboard/expert/blog" audience="advisor" />;
}
