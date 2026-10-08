-- 運営向け RLS ポリシーのうち、vendors.role で管理者を判定していたものを
-- current_user_role() / is_operator()（20260904090000）に置き換える（#757）
--
-- 背景:
--   次のポリシーは
--     exists (select 1 from vendors where vendors.id = auth.uid() and vendors.role in (...))
--   で運営かどうかを判定していた。vendors.role は 20260807120000 で authenticated の列 GRANT から
--   外れているため、ログイン中の利用者がこの式を評価すると "permission denied for table vendors" になる。
--   公開 SELECT ポリシーと同じテーブルに載っている運営向けポリシーは、公開 SELECT のたびに評価されるので、
--   ログイン中の出店者・来訪者が読むだけでも 403 になりうる。
--   また管理者アカウントには vendors 行が無く（20260904090000 のコメント参照）、そもそも運営として通らなかった。
--   判定の単一情報源は auth.users の app_metadata.role（JWT）であり、vendors.role ではない。
--
-- 権限の意味は変えない:
--   - admin / super_admin を許していたもの → 'admin'（super_admin は 20260806104907 で admin に統合済み）
--   - admin のみのもの → 'admin'
--   - admin / super_admin / moderator → is_operator()（admin / moderator）
--
-- 各ポリシーを to authenticated に絞る。current_user_role() / is_operator() は anon に EXECUTE を
--   与えていない（20260904090000）。to を付けない（= public）ままだと、同じテーブルの公開 SELECT を
--   anon が読むときにこの関数の評価で permission denied になる。anon は運営になりえないので、
--   authenticated に限定しても「誰が読めるか／書けるか」は変わらない。
--   service_role は RLS をバイパスするので影響しない。
--
-- 式は (select ...) で包み、InitPlan として1回だけ評価させる（Supabase の RLS パフォーマンス指針）。
-- 冪等: drop policy if exists → create policy。

-- ── admin_audit_logs（閲覧: admin）──────────────────────────────────
drop policy if exists "audit_logs_select_admin" on public.admin_audit_logs;
create policy "audit_logs_select_admin"
  on public.admin_audit_logs
  for select
  to authenticated
  using ((select public.current_user_role()) = 'admin');

-- ── ai_abuse_blocks / ai_abuse_events（閲覧: 運営）──────────────────
drop policy if exists "ai_abuse_blocks_select_admin" on public.ai_abuse_blocks;
create policy "ai_abuse_blocks_select_admin"
  on public.ai_abuse_blocks
  for select
  to authenticated
  using ((select public.is_operator()));

drop policy if exists "ai_abuse_events_select_admin" on public.ai_abuse_events;
create policy "ai_abuse_events_select_admin"
  on public.ai_abuse_events
  for select
  to authenticated
  using ((select public.is_operator()));

-- ── map_landmarks / map_roads / market_locations（管理: admin）───────
drop policy if exists "admin manage map landmarks" on public.map_landmarks;
create policy "admin manage map landmarks"
  on public.map_landmarks
  for all
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "admin manage map_roads" on public.map_roads;
create policy "admin manage map_roads"
  on public.map_roads
  for all
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "admin manage market locations" on public.market_locations;
create policy "admin manage market locations"
  on public.market_locations
  for all
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

-- ── web_visitor_stats / web_visitor_daily_uniques（管理: admin）──────
-- 旧定義の with check は admin のみ、using は admin / super_admin だった。super_admin は廃止済みなので
-- どちらも 'admin' に揃える。
drop policy if exists "admins manage web visitor stats" on public.web_visitor_stats;
create policy "admins manage web visitor stats"
  on public.web_visitor_stats
  for all
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "admins manage web visitor daily uniques" on public.web_visitor_daily_uniques;
create policy "admins manage web visitor daily uniques"
  on public.web_visitor_daily_uniques
  for all
  to authenticated
  using ((select public.current_user_role()) = 'admin')
  with check ((select public.current_user_role()) = 'admin');

drop policy if exists "admins read web visitor daily uniques" on public.web_visitor_daily_uniques;
create policy "admins read web visitor daily uniques"
  on public.web_visitor_daily_uniques
  for select
  to authenticated
  using ((select public.current_user_role()) = 'admin');
