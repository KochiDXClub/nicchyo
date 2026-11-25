-- 商品の旬（product_seasons）の書き込み権限を戻す。
--
-- 20260414081611_remote_schema.sql で "vendors manage own product seasons" を削除したあと、
-- 作り直されていなかった。そのため出店者は旬を保存（削除→追加）できなかった。
-- 20261003100100 の方針どおり、商品の店舗のメンバーで store_edit 権限がある人に限る。
-- 公開読み取り（public read product_seasons）は変えない。

drop policy if exists "vendors manage own product seasons" on public.product_seasons;
create policy "vendors manage own product seasons"
  on public.product_seasons for all to authenticated
  using (
    exists (
      select 1 from public.products
      where products.id = product_seasons.product_id
        and public.has_shop_permission(products.vendor_id, 'store_edit')
    )
  )
  with check (
    exists (
      select 1 from public.products
      where products.id = product_seasons.product_id
        and public.has_shop_permission(products.vendor_id, 'store_edit')
    )
  );
