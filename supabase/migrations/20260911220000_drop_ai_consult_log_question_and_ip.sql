-- AI相談ログから質問文とIPアドレスを落とす。
--
-- 経緯（#629）:
-- ai_consult_logs.question_text と ip_address は書き込まれるだけで、
-- コード上どこからも読まれていなかった。実際に読まれているのは
-- intent_category / keywords / location_type / is_recommendation / consulted_at のみ。
--   - 管理画面の解析      : intent_category, consulted_at
--   - 出店者向けの解析    : intent_category, keywords, location_type, is_recommendation
--   - レート制限          : enforceRateLimit が担当しており、この表は参照しない
--
-- 読み手のないデータを保存期間つきで持つより、最初から持たない方が確実なので列ごと落とす。
-- 会話の継続はクライアント側の状態で成立しているため、機能への影響はない。

-- ── 定期パージから ai_consult_logs.ip_address の NULL 化を外す ────────────
-- pg_cron で毎日動く purge_expired_personal_data()（最新定義は
-- 20260817215000_minimize_web_page_analytics.sql）がこの列を更新している。
-- 列だけ落とすと実行時に「column "ip_address" does not exist」で関数全体が止まり、
-- 他の表の個人情報パージも巻き添えで行われなくなるため、先に関数を置き換える。
-- 他の処理は最新定義から変えていない。
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

  -- 通報: 対応完了から90日で通報者メールをNULL化
  update public.reports
     set reporter_email = null
   where status in ('resolved', 'dismissed')
     and reporter_email is not null
     and updated_at < now() - interval '90 days';

  -- 来訪者ユニーク判定台帳: 重複判定に使うのは当日分だけなので過去分を削除
  -- （日別の来訪者数の履歴は web_visitor_stats に確定値として残る）
  delete from public.web_visitor_daily_uniques
   where visit_date < (now() at time zone 'Asia/Tokyo')::date;

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

alter table public.ai_consult_logs drop column if exists question_text;
alter table public.ai_consult_logs drop column if exists ip_address;

comment on table public.ai_consult_logs is
  'AI相談の利用記録。相談内容そのもの（質問文）とIPアドレスは保存しない。'
  ' 解析に使う意図分類・キーワード・場所種別と、件数の集計に必要な時刻だけを持つ。';
