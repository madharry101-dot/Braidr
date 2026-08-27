-- Storage buckets. Only scalp-photos is explicitly specified by the TRD
-- (private, signed URLs, 1-hour expiry — TRD 6.2). Portfolio/avatar/
-- insurance/credential buckets are implied by the PRD/TRD feature set but
-- not spelled out; privacy defaults below follow the same table in TRD 6.2.
insert into storage.buckets (id, name, public)
values
  ('scalp-photos', 'scalp-photos', false),
  ('portfolio-photos', 'portfolio-photos', true),
  ('avatars', 'avatars', true),
  ('insurance-documents', 'insurance-documents', false),
  ('expert-credentials', 'expert-credentials', false)
on conflict (id) do nothing;

-- scalp-photos: path convention braidcare/{user_id}/{session_id}/{filename}
-- (TRD 2.3.2). Owner-only read/write; the AI analysis pipeline and signed-URL
-- generation run server-side with the service role client, which bypasses
-- storage RLS entirely.
create policy "scalp_photos_owner_rw"
  on storage.objects for all
  using (bucket_id = 'scalp-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'scalp-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- portfolio-photos / avatars: public, world-readable (shown on public
-- profiles and in search results); only the owner (path prefixed with their
-- own user id) may write.
create policy "portfolio_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'portfolio-photos');

create policy "portfolio_photos_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'portfolio-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "portfolio_photos_owner_update"
  on storage.objects for update
  using (bucket_id = 'portfolio-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "portfolio_photos_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'portfolio-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_owner_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- insurance-documents: private. Owner uploads and can read back their own
-- proof of insurance; admin verification reads via the service role client.
create policy "insurance_documents_owner_rw"
  on storage.objects for all
  using (bucket_id = 'insurance-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'insurance-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- expert-credentials: TRD 3.1.6 — "admin access only". Write-only for the
-- expert (upload permitted, no read policy at all, matching "expert cannot
-- re-read after upload"); admin verification reads via the service role.
create policy "expert_credentials_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'expert-credentials' and (storage.foldername(name))[1] = auth.uid()::text);
