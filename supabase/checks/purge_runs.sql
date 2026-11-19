-- 個人データの定期削除 purge_expired_personal_data() が、全マイグレーション適用後の DB で
-- エラーなく最後まで動くことを確かめる（#856）。
--
-- plpgsql は参照先のテーブルを実行時まで確かめないので、削除済みのテーブルを参照していても
-- 関数の作成（create or replace）は通ってしまう。実際に呼んで初めて落ちる。
-- 落ちるとトランザクションごと巻き戻り、どの保存期間の処理も効かなくなる。
--
-- 使い方（CI の Migrations Check で実行している）:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/checks/purge_runs.sql
-- 中身を消さないよう、実行はトランザクションの中で行い最後に巻き戻す。

begin;
select public.purge_expired_personal_data();
rollback;
