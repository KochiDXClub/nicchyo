-- 店舗の「掲載許可」を記録し、許可のない店舗を来訪者に出さないようにする。
--
-- 背景: 運営が現地で出店者に会い、掲載の許可・写真の使用許可をもらいながら店舗情報を登録する運用を始める。
-- 出店者のアカウントとの紐づけは後日（QR）なので、許可は店舗の行そのものに記録する。
--
-- listing_status:
--   pending  … 許可を取っていない（来訪者には出さない）
--   allowed  … 掲載してよい
--   declined … 掲載を断られた（来訪者には出さない。pending と区別して、再度の声かけを避ける）
--
-- 既存の店舗は「許可済み」へ移行する（すでに公開されているものを、この変更で突然消さないため）。
-- 新しく作る店舗（scripts/create-shop-boxes.mjs など）は pending から始まる。

alter table public.vendors
  add column if not exists listing_status text not null default 'allowed',
  add column if not exists photo_use_allowed boolean not null default false,
  add column if not exists listing_consented_on date,
  add column if not exists listing_consent_note text;

-- 既存の行は上の default（allowed）で埋まった。これ以降に作る店舗は未許可から始める
alter table public.vendors alter column listing_status set default 'pending';

alter table public.vendors
  drop constraint if exists vendors_listing_status_check;
alter table public.vendors
  add constraint vendors_listing_status_check
  check (listing_status in ('pending', 'allowed', 'declined'));

comment on column public.vendors.listing_status is
  '掲載許可。pending=未取得 / allowed=許可済み（来訪者に表示）/ declined=断られた。';
comment on column public.vendors.photo_use_allowed is
  '店舗の写真を掲載してよいか（listing_status とは別に記録する）。';
comment on column public.vendors.listing_consented_on is
  '許可をもらった日。';
comment on column public.vendors.listing_consent_note is
  '許可の経緯のメモ（誰からどう許可をもらったか）。来訪者・出店者には公開しない（列の SELECT 権限を付与していない）。';

-- ── 来訪者向けの読み取りを、許可済みの店舗だけに絞る ─────────────────────
-- 旧: 「public read vendors」は using (true)。行があれば即公開されてしまう。
drop policy if exists "public read vendors" on public.vendors;

create policy "public read allowed vendors"
  on public.vendors for select
  to anon, authenticated
  using (listing_status = 'allowed');

-- 許可前の店舗でも、その店舗のメンバーは自分の店舗を読める（編集画面のため）。
-- has_shop_permission は anon に実行権限がないので、anon 用のポリシーとは分ける
create policy "members read own vendor"
  on public.vendors for select
  to authenticated
  using (public.has_shop_permission(id, 'store_edit'));

-- 運営は許可の有無にかかわらず読める（service_role は RLS を通らないので、これは anon キーで
-- ログインした運営のため）
create policy "operators read all vendors"
  on public.vendors for select
  to authenticated
  using (public.is_operator());

-- ポリシーが参照する列。列の SELECT 権限が無くても RLS の判定は動くが、
-- 来訪者側のクエリで許可状態を確認できるように、機微でない listing_status だけ付与する。
-- listing_consent_note / listing_consented_on / photo_use_allowed は付与しない（運営は service_role で読む）
grant select (listing_status) on public.vendors to anon, authenticated;
