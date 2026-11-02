-- 地図の店舗データのキャッシュを「変わった行だけ」で更新できるようにする。
--
-- 背景: 出店者の編集はブラウザから Supabase へ直接書かれるため、サーバーのキャッシュ(15分)を捨てる合図が届かない。
-- そこで、キャッシュの上に「前回の取得以降に変わった行」を30秒ごとに重ねる。そのために次の2つが要る。
--
--   1. updated_at を DB のトリガーで必ず進める
--      今はコードが手で書いていて、書き忘れた保存があると「変わった行」として拾えない。
--   2. 商品を消したときの記録(product_deletions)
--      消えた行は updated_at では拾えない。商品の行は今までどおり本当に消すので、
--      products を読む既存のコードは何も変わらない(削除済みの印を products に足さない)。
--
-- 来訪者(anon)が読める列は、商品の id・店舗の id・消した時刻だけ。書き込みはトリガーだけが行う。

-- ── updated_at を DB で進める ────────────────────────────────────────────
create or replace function public.touch_row_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_products_updated_at on public.products;
create trigger touch_products_updated_at
  before update on public.products
  for each row
  execute function public.touch_row_updated_at();

drop trigger if exists touch_vendors_updated_at on public.vendors;
create trigger touch_vendors_updated_at
  before update on public.vendors
  for each row
  execute function public.touch_row_updated_at();

-- 差分の取得は updated_at で絞る。索引が無いと、そのたびに全件を走査する
create index if not exists products_updated_at_idx on public.products (updated_at);
create index if not exists vendors_updated_at_idx on public.vendors (updated_at);

-- ── 商品を消したときの記録 ────────────────────────────────────────────────
create table if not exists public.product_deletions (
  id bigint generated always as identity primary key,
  product_id uuid not null,
  -- 店舗が消えて商品が連動して消えた場合もあるため、外部キーは張らない
  vendor_id uuid not null,
  deleted_at timestamptz not null default now()
);

create index if not exists product_deletions_deleted_at_idx on public.product_deletions (deleted_at);

alter table public.product_deletions enable row level security;

-- 来訪者に見せるのは、products と同じ条件(来訪者に表示してよい店舗)の行だけ
drop policy if exists "public read listed product_deletions" on public.product_deletions;
create policy "public read listed product_deletions"
  on public.product_deletions for select
  to anon, authenticated
  using (vendor_id in (select id from public.vendors));

-- テーブル全体の権限は付けず、必要な列だけ読めるようにする。書き込みはトリガーだけ
revoke all on public.product_deletions from anon, authenticated;
grant select (product_id, vendor_id, deleted_at) on public.product_deletions to anon, authenticated;

create or replace function public.record_product_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.product_deletions (product_id, vendor_id) values (old.id, old.vendor_id);
  return old;
end;
$$;

-- 古い記録の掃除。まとめて消したときも1回で済むよう、行ごとではなく文ごとに動かす
-- (スケジューラーに頼らない。キャッシュは15分ごとに全件を取り直すので、7日あれば足りる)
create or replace function public.purge_old_product_deletions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.product_deletions where deleted_at < now() - interval '7 days';
  return null;
end;
$$;

drop trigger if exists record_product_deletion on public.products;
create trigger record_product_deletion
  after delete on public.products
  for each row
  execute function public.record_product_deletion();

drop trigger if exists purge_old_product_deletions on public.products;
create trigger purge_old_product_deletions
  after delete on public.products
  for each statement
  execute function public.purge_old_product_deletions();

comment on table public.product_deletions is
  '商品の削除の記録。地図の店舗データのキャッシュが、消えた商品を差分で知るために使う。7日で掃除する。';
