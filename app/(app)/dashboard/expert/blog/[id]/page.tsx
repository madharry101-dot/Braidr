import { PostWorkspace } from "@/components/blog/post-workspace";

export default function ExpertPostPage({ params }: { params: { id: string } }) {
  return <PostWorkspace id={params.id} basePath="/dashboard/expert/blog" />;
}
