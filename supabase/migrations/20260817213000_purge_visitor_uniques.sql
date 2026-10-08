-- 来訪者ユニーク判定台帳（web_visitor_daily_uniques）の過去分を日次で削除する
--
-- 背景:
--   web_visitor_daily_uniques は「その日の visitor_key をカウント済みか」の
--   重複判定にしか使われず、翌日以降に参照する処理は存在しない
--   （日別の人数の履歴は visitor_key を含まない web_visitor_stats が保持する）。
--   過去分の行は何の機能も支えないまま訪問者識別子を蓄積するだけなので削除する。
--
-- 対策:
--   purge_expired_personal_data() に当日分以外の削除を追加する。

create or replace function public.purge_expired_personal_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- AI相談ログ: レートリミット用IPは30日でNULL化
  update public.ai_consult_logs
     set ip_address = null
   where ip_address is not null
     and created_at < now() - interval '30 days';

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
end;
$$;

-- 既存の過去分もこの場で削除する
delete from public.web_visitor_daily_uniques
 where visit_date < (now() at time zone 'Asia/Tokyo')::date;

-- 目的: 機能を支えていない訪問者識別子の蓄積をやめる。
