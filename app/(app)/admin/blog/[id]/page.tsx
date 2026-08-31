import { PostWorkspace } from "@/components/blog/post-workspace";

export default async function AdminPostPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <PostWorkspace id={params.id} basePath="/admin/blog" />;
}
