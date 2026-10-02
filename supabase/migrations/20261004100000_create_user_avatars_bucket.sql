-- ログインアカウントのプロフィール写真（アイコン）用 Storage バケット。
--
-- 出店者は Google でログインするので、名前と写真は Google の値が初期値になる。
-- アカウント設定から本人が変えられるようにするため、本人のフォルダにだけ書けるバケットを用意する。
--   パス: {user_id}/{ファイル名}   （店舗のフォルダ vendor-images/{vendor_id}/ とは別。店舗の権限とは無関係）
-- 画像は、画面で小さくリサイズしてから上げる。
--
-- 写真の URL は auth の user_metadata.avatarUrl に入れる（画像の中身は入れない。JWT が大きくなるため）。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-avatars',
  'user-avatars',
  true,
  524288,  -- 512KB（画面で 256px 程度に縮小してから上げる）
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 書き込み（追加・上書き・削除）は、自分のフォルダだけ
drop policy if exists "users insert own avatar" on storage.objects;
create policy "users insert own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'user-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 公開バケットなので、URL を知っていれば画像は誰でも見られる（メンバー一覧や操作ログで他のメンバーにも見せるため）。
-- 一覧の取得（list）まで開く必要はないので、select のポリシーは作らない。
