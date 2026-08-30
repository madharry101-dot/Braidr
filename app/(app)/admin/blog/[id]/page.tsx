import { PostWorkspace } from "@/components/blog/post-workspace";

export default function AdminPostPage({ params }: { params: { id: string } }) {
  return <PostWorkspace id={params.id} basePath="/admin/blog" />;
}
