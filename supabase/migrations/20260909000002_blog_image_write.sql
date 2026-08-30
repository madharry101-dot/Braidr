-- PART 2 (cont.) — write policies for the blog-images bucket.
--
-- The bucket itself (public, read-only to the world) is created in
-- 20260909000001. This adds the write side. Separate migration rather than
-- an edit to that file so it applies cleanly whether or not the first has
-- already been run.
--
-- Uploads go through POST /api/blog/images on the service-role client after
-- the route checks the caller is an admin or advisor, so these policies are
-- defence in depth — the same shape as portfolio-photos, which is also
-- written by an admin-client route.
--
-- NOTE: blog images are deliberately in their own public bucket. They are
-- never mixed with scalp-photos, which is private, owner-scoped, and purged
-- after 90 days — publishing a scalp photo to a world-readable URL is
-- exactly the failure this separation prevents.

-- Path convention: blog-images/{author_user_id}/{filename}
create policy "blog_images_staff_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'blog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'expert')
    )
  );

create policy "blog_images_staff_update_own"
  on storage.objects for update
  using (
    bucket_id = 'blog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "blog_images_staff_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'blog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
