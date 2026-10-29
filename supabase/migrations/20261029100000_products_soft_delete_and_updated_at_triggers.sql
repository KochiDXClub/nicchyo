-- 目的: 地図の店舗キャッシュを「変わった行だけ取る」差分更新にするための土台。
--   1. products に deleted_at（論理削除）を足す。行を物理的に消すと、
--      「updated_at が前回より新しい行」を取る差分クエリでは削除を検知できないため。
--   2. vendors / products の updated_at を、どの書き込み経路でも DB 側で必ず更新する。
--      出店者のブラウザ・管理画面 API・SQL の直接実行のどれから更新しても差分に載る。
--   3. 論理削除した行は、来訪者・出店者・運営の誰にも RLS で読ませない（service_role は
--      RLS を通らないので、読む側が deleted_at is null を明示する）。

-- ── 1. 論理削除 ──────────────────────────────────────────────────────
alter table public.products add column if not exists deleted_at timestamptz;

-- ── 2. updated_at を必ず更新するトリガー ─────────────────────────────
-- クライアントが updated_at を送ってくる場合（ブラウザの時計）も上書きして、DB の時計に揃える。
-- now() ではなく clock_timestamp() を使うのは、長いトランザクションの中で更新した行が
-- トランザクション開始時刻のまま記録され、差分の基準より古くなるのを避けるため。
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new is distinct from old then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists touch_vendors_updated_at on public.vendors;
create trigger touch_vendors_updated_at
  before insert or update on public.vendors
  for each row
  execute function public.touch_updated_at();

drop trigger if exists touch_products_updated_at on public.products;
create trigger touch_products_updated_at
  before insert or update on public.products
  for each row
  execute function public.touch_updated_at();

-- 差分クエリ（updated_at > 前回）と、論理削除の一覧・掃除のための索引
create index if not exists vendors_updated_at_idx on public.vendors (updated_at);
create index if not exists products_updated_at_idx on public.products (updated_at);
create index if not exists products_deleted_at_idx on public.products (deleted_at) where deleted_at is not null;

-- ── 3. 論理削除した行を RLS で隠す ───────────────────────────────────
-- 来訪者（anon）と、許可済みの店舗の商品を読む認証済みユーザー
drop policy if exists "public can read listed products" on public.products;
create policy "public can read listed products"
  on public.products for select
  using (deleted_at is null and vendor_id in (select id from public.vendors));

-- 店舗のメンバー用の "vendors manage own products"（for all）は、読む権限と書く権限を分ける。
-- for all のままだと、自分の店舗の論理削除した行まで読めてしまう。
-- 論理削除は UPDATE（deleted_at をセット）で行う。UPDATE の戻り値（.select()）を付けると、
-- 更新後の行が「読める行」の条件を満たさず RLS エラーになるので、付けないこと。
drop policy if exists "vendors manage own products" on public.products;

create policy "vendors read own products"
  on public.products for select to authenticated
  using (deleted_at is null and public.has_shop_permission(vendor_id, 'store_edit'));

create policy "vendors insert own products"
  on public.products for insert to authenticated
  with check (public.has_shop_permission(vendor_id, 'store_edit'));

create policy "vendors update own products"
  on public.products for update to authenticated
  using (public.has_shop_permission(vendor_id, 'store_edit'))
  with check (public.has_shop_permission(vendor_id, 'store_edit'));

create policy "vendors delete own products"
  on public.products for delete to authenticated
  using (public.has_shop_permission(vendor_id, 'store_edit'));
