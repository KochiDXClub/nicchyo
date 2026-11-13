-- 検索ログ（product_search_logs）を 90 日で消す（purge_expired_personal_data の追加分、#923）。
--
-- 背景:
-- 検索語は来訪者が自由に打つ文章なので、名前や電話番号が入ることがある。
-- これまで消す仕組みが無く、全期間の検索語が残り続けていた。
-- 使っているのは直近 7 日分（出店者の検索トレンド・にちよさん相談・管理画面の解析）と、
-- 管理画面の CSV 出力（最大 365 日）だけ。保存期間は運営と相談して 90 日に決めた
-- （ai_abuse_events と同じ。季節ごとの振り返り・報告に足りる長さ）。
--
-- 最新定義（20261007110000_privacy_retention_purge.sql）に、検索ログの削除を 1 つ足しただけで、
-- 既存の処理は 1 つも変えていない（lib/privacy/purgeMigration.test.ts で確かめている）。
--
-- 注意（不可逆）:
-- 本番に適用した後、最初の定期実行（pg_cron）で 90 日より前の検索ログがすべて削除される。
-- それより古い分が必要なら、適用の前に管理画面の CSV 出力で取っておくこと（docs/RELEASE.md §4.2）。
-- searched_at には索引（idx_product_search_logs_searched_at）がある。

create or replace function public.purge_expired_personal_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 店舗インタラクション: 週次レポート集計後は不要なので8日でNULL化
  update public.shop_interactions
     set ip_address = null
   where ip_address is not null
     and created_at < now() - interval '8 days';

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

  -- 検索ログ: 生の検索語に名前や電話番号が入りうるので、90日で行ごと削除（#923）
  delete from public.product_search_logs
   where searched_at < now() - interval '90 days';

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
