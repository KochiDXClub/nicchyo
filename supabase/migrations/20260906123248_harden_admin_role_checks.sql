-- 管理者判定を JWT の app_metadata.role に統一する
--
-- 初期のマイグレーション群は RLS の管理者判定に
--   coalesce(app_metadata ->> 'role', user_metadata ->> 'role')
-- を使っていたが、アプリ側の基準（lib/auth/permissions.ts の getRole()）は
-- app_metadata のみを見る。user_metadata は改ざん可能なため判定に使わない。
-- 判定を app_metadata 一本に揃える。
-- 先例: 20260903163238_create_map_perf_runs.sql
--
-- 対象は「その時点で存在するテーブル」だけ。すでに drop 済みのもの
-- （web_daily_visitor_summaries / coupon 系）は to_regclass のガードで飛ばす。
--
-- 注意: system_settings の "anyone reads non-sensitive system settings"
-- （key in ('public','page_visibility') の anon SELECT）は触らない。
-- proxy.ts と app/api/page-visibility が anon キーでこれを読んでおり、
-- 剥がすとメンテナンス判定とページ公開判定が壊れる。
--
-- super_admin は 20260806104907_unify_super_admin_into_admin.sql で
-- admin に統合済みなので、判定値は 'admin' だけでよい。

do $$
begin
  if to_regclass('public.system_settings') is null then return; end if;

  drop policy if exists "admins read system settings" on public.system_settings;
  create policy "admins read system settings"
    on public.system_settings for select to authenticated
    using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

  drop policy if exists "admins manage system settings" on public.system_settings;
  create policy "admins manage system settings"
    on public.system_settings for all to authenticated
    using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
    with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
end $$;

do $$
begin
  if to_regclass('public.map_layout_snapshots') is null then return; end if;

  drop policy if exists "admins read map layout snapshots" on public.map_layout_snapshots;
  create policy "admins read map layout snapshots"
    on public.map_layout_snapshots for select to authenticated
    using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

  drop policy if exists "admins insert map layout snapshots" on public.map_layout_snapshots;
  create policy "admins insert map layout snapshots"
    on public.map_layout_snapshots for insert to authenticated
    with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
end $$;

do $$
begin
  if to_regclass('public.web_page_analytics') is null then return; end if;

  drop policy if exists "admins read page analytics" on public.web_page_analytics;
  create policy "admins read page analytics"
    on public.web_page_analytics for select to authenticated
    using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
end $$;

do $$
begin
  if to_regclass('public.web_daily_visitor_summaries') is null then return; end if;

  drop policy if exists "admins read daily visitor summaries" on public.web_daily_visitor_summaries;
  create policy "admins read daily visitor summaries"
    on public.web_daily_visitor_summaries for select to authenticated
    using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
end $$;

do $$
begin
  if to_regclass('public.web_page_daily_summaries') is null then return; end if;

  drop policy if exists "admins read page daily summaries" on public.web_page_daily_summaries;
  create policy "admins read page daily summaries"
    on public.web_page_daily_summaries for select to authenticated
    using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
end $$;

do $$
begin
  if to_regclass('public.shop_interactions') is null then return; end if;

  drop policy if exists si_admin_select on public.shop_interactions;
  create policy si_admin_select
    on public.shop_interactions for select to authenticated
    using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
end $$;

-- 取りこぼしの検出。今後 user_metadata を使うポリシーが増えたら
-- migrations-check（まっさらなDBへの全適用）がここで落ちる。
do $$
declare
  leftover int;
begin
  select count(*) into leftover
  from pg_policies
  where schemaname = 'public'
    and (coalesce(qual, '') like '%user_metadata%'
      or coalesce(with_check, '') like '%user_metadata%');

  if leftover > 0 then
    raise exception '管理者判定に user_metadata を使うポリシーが % 件残っています', leftover;
  end if;
end $$;

-- 目的: RLS の管理者判定をアプリ側（app_metadata）と同じ基準に揃える。
