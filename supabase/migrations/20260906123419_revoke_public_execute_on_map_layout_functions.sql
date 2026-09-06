-- マップ配置用の SECURITY DEFINER 関数を service_role 専用にする
--
-- 関数を作ると EXECUTE は既定で PUBLIC に付く。
-- 既存のマイグレーションは
--   revoke execute on function ... from anon, authenticated;
-- しか書いておらず、PUBLIC の分が残るため anon から実行できる状態だった
-- （anon は PUBLIC を継承する）。
--
-- 対象はいずれも SECURITY DEFINER で、map_route_points の全削除や
-- 配置スナップショットの復元など破壊的な操作を行う。
-- 呼び出しは app/api/admin/map-layout の createAdminWriteClient()
-- （service role）からのみで、ブラウザからは呼ばない。
--
-- 関数シグネチャを直書きせず pg_proc から引くのは、引数が変わっても
-- このマイグレーションが壊れないようにするため。

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'save_roads_and_points',
        'restore_map_layout_snapshot',
        'replace_map_route_points',
        'rls_auto_enable'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.sig);
    execute format('grant execute on function %s to service_role', fn.sig);
  end loop;
end $$;

-- 目的: 公開されている anon キーだけでマップの道・配置を書き換えられる経路を塞ぐ。
