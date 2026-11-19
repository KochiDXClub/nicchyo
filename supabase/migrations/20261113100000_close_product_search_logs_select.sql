-- 検索ログ（product_search_logs）をログインユーザーが直接読めないようにする（#922）
--
-- 背景:
-- product_search_logs には "authenticated users can read search logs"（using (auth.role() = 'authenticated')）
-- が付いていた（20260310001000）。来訪者も /signup でアカウントを作れるので、
-- ログインさえすれば誰でも全員の生の検索語を読めた。検索語には氏名や電話番号が入りうる。
--
-- #926 で読み取りをすべてサーバー側の service role に移した（本番 main / v1.5 に反映済み）:
--   - 出店者の検索トレンド  GET /api/vendor/search-trends（lib/analytics/searchTrends.server.ts）
--   - ヘルプチャットの集計  lib/vendor/helpChatStats.server.ts
--   - 管理画面の解析        app/(public)/admin/analytics/page.tsx（createAdminReadClient）
--   - 管理画面の CSV 出力   app/api/admin/analytics/export/route.ts（adminClient）
-- ブラウザ・cookie クライアントから読むコードは本番にも develop にも残っていないので、
-- このマイグレーションは Vercel のデプロイとどちらが先に本番へ流れても壊れない。
--
-- service role は RLS も以下の REVOKE も受けないので、上の読み取りと
-- POST /api/analytics/search-log の書き込みは影響を受けない。
--
-- 注意: 20260911220100_tighten_log_table_grants.sql のコメント
-- 「product_search_logs  認証ユーザーが読む既存ポリシーあり」は、この変更で古くなる
-- （適用済みのマイグレーションは書き換えない）。
--
-- 2 回流しても同じ結果になる（drop policy if exists / revoke はどちらも冪等）。

-- 認証ユーザーの SELECT ポリシーを外し、権限も剥がす（防御を RLS の 1 枚にしない）
drop policy if exists "authenticated users can read search logs" on public.product_search_logs;
revoke select on public.product_search_logs from anon, authenticated;
