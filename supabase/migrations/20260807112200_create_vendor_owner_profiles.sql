-- 出店者本人の氏名を vendors から分離し、公開/非公開を出店者が管理できるようにする
--
-- 背景:
--   vendors.owner_name（出店者本人の実名）は
--     - "public read vendors" USING (true) + GRANT SELECT TO anon により
--       未ログインの誰でも取得できる
--     - RAG のベクトル化 (app/api/admin/sync-embeddings) と
--       AI 会話プロンプト (lib/grandma/vendorSearch.ts の summarizeShops) を通じて
--       OpenAI に送信される
--   店舗情報と個人情報が同一テーブルに同居していることが原因で、
--   店舗情報を取得するどの経路でも氏名が一緒に流れていた。
--
-- 対策:
--   氏名を専用テーブルに切り出し、既定を非公開にしたうえで
--   出店者自身が公開状態を切り替えられるようにする。

create table if not exists public.vendor_owner_profiles (
  vendor_id  uuid primary key references public.vendors(id) on delete cascade,
  owner_name text,
  is_public   boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.vendor_owner_profiles is
  '出店者本人の氏名。vendors から分離し、is_public で公開可否を出店者が管理する。';
comment on column public.vendor_owner_profiles.is_public is
  'true のとき地図・検索など公開画面に氏名を表示する。新規登録時の既定は非公開。';

-- 既存データの移行。
-- 移行前の owner_name は地図の店舗詳細バナーと検索結果カードで公開表示されていたため、
-- 既存行は is_public = true として現在の見え方を維持する。
-- 以降に登録される出店者は列の既定値どおり非公開から始まる。
insert into public.vendor_owner_profiles (vendor_id, owner_name, is_public)
select id, owner_name, true
from public.vendors
where owner_name is not null
  and btrim(owner_name) <> ''
on conflict (vendor_id) do nothing;

create index if not exists vendor_owner_profiles_is_public_idx
  on public.vendor_owner_profiles (is_public)
  where is_public = true;

-- updated_at の自動更新
create or replace function public.touch_vendor_owner_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_vendor_owner_profiles_updated_at
  on public.vendor_owner_profiles;

create trigger touch_vendor_owner_profiles_updated_at
  before update on public.vendor_owner_profiles
  for each row
  execute function public.touch_vendor_owner_profiles_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────
alter table public.vendor_owner_profiles enable row level security;

-- 公開設定された氏名だけが匿名でも読める
drop policy if exists "public read published owner names" on public.vendor_owner_profiles;
create policy "public read published owner names"
  on public.vendor_owner_profiles
  for select
  to anon, authenticated
  using (is_public = true);

-- 出店者本人は公開状態にかかわらず自分の行を読める
drop policy if exists "vendors read own owner profile" on public.vendor_owner_profiles;
create policy "vendors read own owner profile"
  on public.vendor_owner_profiles
  for select
  to authenticated
  using (auth.uid() = vendor_id);

drop policy if exists "vendors insert own owner profile" on public.vendor_owner_profiles;
create policy "vendors insert own owner profile"
  on public.vendor_owner_profiles
  for insert
  to authenticated
  with check (auth.uid() = vendor_id);

drop policy if exists "vendors update own owner profile" on public.vendor_owner_profiles;
create policy "vendors update own owner profile"
  on public.vendor_owner_profiles
  for update
  to authenticated
  using (auth.uid() = vendor_id)
  with check (auth.uid() = vendor_id);

-- 管理者は公開状態にかかわらず全件読める（管理画面のユーザー一覧・店舗一覧で使用）
drop policy if exists "admins read all owner profiles" on public.vendor_owner_profiles;
create policy "admins read all owner profiles"
  on public.vendor_owner_profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from public.vendors
      where vendors.id = auth.uid()
        and vendors.role = 'admin'
    )
  );

grant select on public.vendor_owner_profiles to anon;
grant select, insert, update on public.vendor_owner_profiles to authenticated;

-- ── vendors 側の匿名アクセスを列単位に絞る ────────────────────────────
-- "public read vendors" USING (true) は全列を対象にするため、
-- 氏名を分離しても vendors.owner_name が残っている限り anon から読めてしまう。
-- あわせて role / must_change_password も匿名に晒す理由がないため、
-- 公開画面が実際に使う列だけを明示的に GRANT する。
revoke select on public.vendors from anon;

grant select (
  id,
  shop_name,
  strength,
  style,
  style_tags,
  category_id,
  main_products,
  main_product_prices,
  payment_methods,
  rain_policy,
  schedule,
  shop_image_url,
  sns_instagram,
  sns_x,
  sns_hp,
  business_hours_start,
  business_hours_end,
  closed_dates,
  created_at,
  updated_at
) on public.vendors to anon;

-- 目的: 出店者の氏名を独立したテーブルで管理し、既定非公開＋本人による公開制御にする。
