-- get_shop_attendance_estimates を SECURITY DEFINER にする
--
-- 20260807112100_close_anon_access_on_unused_tables.sql で
-- shop_attendance_vendor / shop_attendance_votes への anon, authenticated の
-- 直接アクセスを閉じたが、get_shop_attendance_estimates（20260414081611_remote_schema.sql）
-- はデフォルトの SECURITY INVOKER のままこの2テーブルを直接 SELECT しており、
-- 呼び出し元（anon）の権限で実行されるため permission denied になっていた。
--
-- マップページ（app/(public)/map/fetch-map-data.ts）は毎回このRPCを
-- anon キーの SSR クライアントで呼んでおり、エラーを try/catch で握りつぶして
-- 空データにフォールバックするため、出店確度バッジが全ユーザーで静かに機能停止する。
--
-- 対応: 関数を SECURITY DEFINER にして所有者権限で実行させる。
-- テーブルへの anon/authenticated の直接アクセスは引き続き閉じたままにできる。
-- search_path は SECURITY DEFINER のセキュリティ上のベストプラクティスとして固定する。
alter function public.get_shop_attendance_estimates(date)
  security definer
  set search_path = public, pg_temp;

-- 目的: 匿名アクセスを閉じたテーブルに依存する RPC 経由の間接参照を復旧する。
