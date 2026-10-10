-- 使われていないテーブル 9 件と、それだけを読む関数 1 件を削除する（#630 の整理）。
--
-- 2026-10-08 に本番アプリが使っている DB（dbaufykimgzfgoeyyxwz）とコード（develop）で確認した:
--   - アプリ（app/ lib/ components/）から読み書きしている箇所が無い
--   - 他のテーブルからの外部キー、ビュー、トリガ、関数からの参照が無い
--     （例外は get_shop_attendance_estimates だけで、これもコードから呼ばれていないので一緒に消す）
--
--   todos                  Supabase の動作確認用サンプル（4 行・アプリのデータではない）
--   shops_import           初期データ取り込み用。id は削除済みの旧 shops のもので vendors と一致しない
--   shops_strong           同上
--   shops_topic_import     同上
--   shops_name_staging     屋号の取り込み用。300 件中 299 件が vendors.shop_name に取り込み済み
--   shop_attendance_vendor 旧・出店予測。shop_id は旧 shops を指す。今は vendor_weekly_status が担う
--   shop_attendance_votes  同上
--   report_readers         セキュリティレポート閲覧者の許可リスト。閲覧はロールで判定しており未使用（0 行）
--   product_sales          ver1.4 で出店者画面から読み書きが無くなった（テスト入力 3 行のみ）
--
-- 消すとデータは戻らない。必要なら適用前にバックアップを取ること。
-- 冪等: drop ... if exists。

drop function if exists public.get_shop_attendance_estimates(date);

drop table if exists public.todos;
drop table if exists public.shops_import;
drop table if exists public.shops_strong;
drop table if exists public.shops_topic_import;
drop table if exists public.shops_name_staging;
drop table if exists public.shop_attendance_votes;
drop table if exists public.shop_attendance_vendor;
drop table if exists public.report_readers;
drop table if exists public.product_sales;
