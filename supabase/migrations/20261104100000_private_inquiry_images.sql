-- 非公開の連絡画像を公開の店舗写真から分離する。
-- 旧画像はStorage APIでコピー・照合・参照更新後に公開側から削除する必要がある。
-- scripts/migrate-inquiry-images.mjs（既定はdry-run）とセキュリティレビューの手順を参照。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-inquiry-images', 'vendor-inquiry-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members upload private inquiry images" on storage.objects;
create policy "members upload private inquiry images" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'vendor-inquiry-images'
    and (storage.foldername(name))[2] = 'inquiries'
    and array_length(storage.foldername(name), 1) = 2
    and name ~* '/inquiries/[a-zA-Z0-9_-]+\.(webp|png|jpe?g)$'
    and exists (select 1 from public.shop_members m
      where m.vendor_id::text = (storage.foldername(name))[1]
        and m.user_id = (select auth.uid())
        and public.has_shop_permission(m.vendor_id, 'inquiries'))
  );
drop policy if exists "members read private inquiry images" on storage.objects;
create policy "members read private inquiry images" on storage.objects
  for select to authenticated using (
    bucket_id = 'vendor-inquiry-images' and (
      (select public.is_operator()) or exists (select 1 from public.shop_members m
        where m.vendor_id::text = (storage.foldername(name))[1]
          and m.user_id = (select auth.uid())
          and public.has_shop_permission(m.vendor_id, 'inquiries')))
  );
drop policy if exists "members delete private inquiry images" on storage.objects;
create policy "members delete private inquiry images" on storage.objects
  for delete to authenticated using (
    bucket_id = 'vendor-inquiry-images'
    and exists (select 1 from public.shop_members m
      where m.vendor_id::text = (storage.foldername(name))[1]
        and m.user_id = (select auth.uid())
        and public.has_shop_permission(m.vendor_id, 'inquiries'))
  );

-- 旧クライアントの公開アップロードを拒否し、旧フォルダの匿名列挙も閉じる。
-- 公開バケットの既存URLはRLSを通らないため、この変更だけで失効したとは扱わない。
drop policy if exists "no public inquiry image uploads" on storage.objects;
create policy "no public inquiry image uploads" on storage.objects as restrictive
  for insert to authenticated with check (
    bucket_id <> 'vendor-images' or (storage.foldername(name))[2] is distinct from 'inquiries');
drop policy if exists "no public inquiry image updates" on storage.objects;
create policy "no public inquiry image updates" on storage.objects as restrictive
  for update to authenticated using (
    bucket_id <> 'vendor-images' or (storage.foldername(name))[2] is distinct from 'inquiries')
  with check (
    bucket_id <> 'vendor-images' or (storage.foldername(name))[2] is distinct from 'inquiries');
drop policy if exists "no public inquiry image listing" on storage.objects;
create policy "no public inquiry image listing" on storage.objects as restrictive
  for select to anon, authenticated using (
    bucket_id <> 'vendor-images' or (storage.foldername(name))[2] is distinct from 'inquiries');
