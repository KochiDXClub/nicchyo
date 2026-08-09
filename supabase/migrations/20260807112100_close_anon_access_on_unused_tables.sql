-- anon に開きっぱなしのテーブルを閉じる
--
-- 20260414081611_remote_schema.sql は複数のテーブルに
--   grant delete/insert/references/select/trigger/truncate/update to anon
-- を付けており、うち一部は USING (true) の SELECT ポリシーまで持っている。
-- 本番 DB に anon キーで実アクセスして確認したところ、
-- todos と shop_attendance_vendor は実データを返していた。
--
-- データを失わないよう DROP TABLE は行わず、アクセス権のみを閉じる。
-- テーブル自体が不要と確認できた時点で別途削除すること。

-- ── todos（Supabase 導入時の動作確認用。app/(public)/supabase-test でのみ参照） ──
drop policy if exists "Enable read access for all users" on public.todos;
revoke all on public.todos from anon, authenticated;

-- ── shop_attendance_vendor / shop_attendance_votes（アプリコードから参照なし） ──
drop policy if exists "vendor_select_all" on public.shop_attendance_vendor;
drop policy if exists "vendor_insert_self" on public.shop_attendance_vendor;
revoke all on public.shop_attendance_vendor from anon, authenticated;

drop policy if exists "votes_select_all" on public.shop_attendance_votes;
drop policy if exists "votes_insert_self" on public.shop_attendance_votes;
revoke all on public.shop_attendance_votes from anon, authenticated;

-- ── 取り込み用ステージングテーブル（RLS 有効・ポリシー無しだが GRANT だけ残っている） ──
revoke all on public.shops_import from anon, authenticated;
revoke all on public.shops_strong from anon, authenticated;
revoke all on public.shops_name_staging from anon, authenticated;
revoke all on public.shops_topic_import from anon, authenticated;

-- ── product_sales ──
-- 出店者ダッシュボードの「市場トレンド」(app/vendor/_services/analyticsService.ts)
-- が全出店者の売上を集計するため全件 SELECT 自体は必要だが、
-- 未ログインの一般来訪者に出店者の売上を見せる理由はない。
drop policy if exists "public can read product_sales" on public.product_sales;

create policy "authenticated can read product_sales"
  on public.product_sales
  for select
  to authenticated
  using (true);

revoke all on public.product_sales from anon;

-- 目的: 未使用テーブルと売上データへの匿名アクセスを遮断する。
