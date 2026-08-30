"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { PostEditor } from "@/components/blog/post-editor";
import { useCreateBlogPost } from "@/lib/hooks/blog";

export function NewPost({ basePath }: { basePath: string }) {
  const router = useRouter();
  const create = useCreateBlogPost();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={basePath} className="text-sm text-teal-deep hover:text-plum">
          ← All posts
        </Link>
        <PageHeader
          title="New post"
          subtitle="Saved as a draft. Submit it for review when you're ready — publishing needs someone else to sign it off."
        />
      </div>

      <PostEditor
        submitLabel="Save draft"
        pending={create.isPending}
        onSubmit={async (input) => {
          const created = await create.mutateAsync(input);
          router.push(`${basePath}/${created.id}`);
        }}
      />
    </div>
  );
}
