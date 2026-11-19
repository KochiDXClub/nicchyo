-- 個人データの定期削除 purge_expired_personal_data() が毎回丸ごと失敗していたのを直す（#856）。
--
-- 背景:
-- 関数の最初の文が `update public.shop_interactions ...` だったが、このテーブルは
-- 20260414081611_remote_schema.sql で DROP され、以後作り直されていない。
-- plpgsql は参照先のテーブルを実行時まで確かめないので、関数の作成は通るが、
-- pg_cron の毎日の実行は relation does not exist で失敗し、トランザクションごと巻き戻っていた。
-- そのため後続の処理（問い合わせ・通報の連絡先の NULL 化、ai_abuse_events の削除、
-- AI 相談への評価の文の NULL 化、vendor_help_logs の削除、web_page_analytics の集計と 35 日削除など）が
-- 一度も効いていなかった。開発 DB で shop_interactions が存在しないことを確認済み。
--
-- 最新定義（20261007110000_privacy_retention_purge.sql）から shop_interactions の UPDATE だけを外した。
-- ほかの処理は 1 つも変えていない（lib/privacy/purgeMigration.test.ts で確かめている）。
-- 全マイグレーション適用後の DB で関数が最後まで動くことは supabase/checks/purge_runs.sql で確かめる。
--
-- 注意（不可逆）:
-- 本番に適用した後、最初の定期実行（毎日 18:00 UTC）で、これまで溜まっていた保存期間切れのデータが
-- まとめて削除・NULL 化される（例: 35 日より前の web_page_analytics の行すべて）。
-- 必要なデータがあれば、適用の前に取っておくこと。

create or replace function public.purge_expired_personal_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  -- 不正利用ブロック: 解除済みのものは90日で識別子をNULL化（履歴行は残す）
  update public.ai_abuse_blocks
     set ip_address = null,
         visitor_key = null
   where is_active = false
     and (ip_address is not null or visitor_key is not null)
     and created_at < now() - interval '90 days';

  -- 不正利用イベントログ: 90日で行ごと削除
  delete from public.ai_abuse_events
   where created_at < now() - interval '90 days';

  -- 管理者監査ログ: 監査証跡は残しつつIPのみ365日でNULL化
  update public.admin_audit_logs
     set ip_address = null
   where ip_address is not null
     and created_at < now() - interval '365 days';

  -- 問い合わせ: 対応完了から90日で氏名・メールをNULL化
  update public.inquiries
     set email = null,
         name = null
   where status in ('resolved', 'closed')
     and (email is not null or name is not null)
     and updated_at < now() - interval '90 days';

  -- 問い合わせ: 未対応のまま放置された行も、作成から365日で氏名・メールをNULL化
  update public.inquiries
     set email = null,
         name = null
   where (email is not null or name is not null)
     and created_at < now() - interval '365 days';

  -- 通報: 対応完了から90日で通報者メールをNULL化
  update public.reports
     set reporter_email = null
   where status in ('resolved', 'dismissed')
     and reporter_email is not null
     and updated_at < now() - interval '90 days';

  -- 通報: 未対応のまま放置された行も、作成から365日で通報者メールと自由記述をNULL化
  update public.reports
     set reporter_email = null,
         details = null
   where (reporter_email is not null or details is not null)
     and created_at < now() - interval '365 days';

  -- AI相談への評価: 質問文・回答文・コメントは180日でNULL化（👍👎の評価と日時は残す）
  update public.ai_consult_feedback
     set question_text = null,
         turn_text = null,
         comment = null
   where (question_text is not null or turn_text is not null or comment is not null)
     and created_at < now() - interval '180 days';

  -- 来訪者ユニーク判定台帳: 重複判定に使うのは当日分だけなので過去分を削除
  -- （日別の来訪者数の履歴は web_visitor_stats に確定値として残る）
  delete from public.web_visitor_daily_uniques
   where visit_date < (now() at time zone 'Asia/Tokyo')::date;

  -- 出店者の相談（にちよさん）: 案内の改善に使うのは直近の分だけなので、180日で行ごと削除
  delete from public.vendor_help_logs
   where created_at < now() - interval '180 days';

  -- ページ解析: 日次サマリーへ集計してから、生ログを35日で削除
  perform public.aggregate_web_page_daily_summaries();
  delete from public.web_page_analytics
   where visit_date < (now() at time zone 'Asia/Tokyo')::date - 35;
end;
$$;

-- create or replace は既存の権限を引き継ぐが、念のため直接実行できないことを明示する
revoke execute on function public.purge_expired_personal_data() from public;
revoke execute on function public.purge_expired_personal_data() from anon;
revoke execute on function public.purge_expired_personal_data() from authenticated;
