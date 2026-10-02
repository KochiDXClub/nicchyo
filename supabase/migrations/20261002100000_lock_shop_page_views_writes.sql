-- shop_page_views への書き込みを、サーバー（POST /api/analytics/shop-view、service_role）だけにする
--
-- 作成時（20260309004000）の "anyone can insert page views"（for insert with check (true)）が残っていて、
-- 公開の anon キーで、好きな vendor_id の行をいくらでも足せた。
-- 出店者の「お店の分析」の主役が「お店が見られた回数」になるので、API の守り
-- （同一オリジン・回数制限・本人の分は数えない）を通らない書き込み口を閉じる。
-- 書き込みはこれ以降 service_role だけ（service_role は RLS を通らず、権限は既定のまま残る）。
-- 20260911220100 の「INSERT を絞るならポリシー側の見直しが別途必要」の、この表の分。

drop policy if exists "anyone can insert page views" on public.shop_page_views;
revoke insert on table public.shop_page_views from anon, authenticated;

-- 流入元は3つだけ。将来の書き込み口が増えても、知らない値が入らないようにする。
-- not valid は、すでにある行は確かめず、これから入る行だけを確かめる（記録の入口が無かった表なので、
-- 既存の行に知らない値があっても本番の適用を止めない）
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_page_views_source_check') then
    alter table public.shop_page_views
      add constraint shop_page_views_source_check check (source in ('map', 'search', 'direct')) not valid;
  end if;
end;
$$;
