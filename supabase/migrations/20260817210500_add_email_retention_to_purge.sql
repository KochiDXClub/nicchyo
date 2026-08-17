-- 問い合わせ・通報のメールアドレスにも保持期限を設ける
--
-- 背景:
--   inquiries.email / inquiries.name / reports.reporter_email は
--   対応完了（resolved / closed / dismissed）後も無期限に平文で残り続けていた。
--   さらに user_id は退会時に ON DELETE SET NULL で消える一方、
--   email 列はそのまま残るため、退会後もメールアドレスが保持されていた。
--
-- 対策:
--   対応完了から90日経過した行の氏名・メールアドレスをNULL化する。
--   問い合わせ・通報の本文や対応記録は業務記録として残す。
--   （purge_expired_personal_data() に処理を追加し、既存のIP保持期限と
--    同じ日次ジョブで実行する）

-- NULL化できるよう NOT NULL 制約を外す（新規投稿はアプリ側で必須のまま）
alter table public.inquiries alter column email drop not null;

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
end;
$$;

-- 目的: 対応が終わった問い合わせ・通報から連絡先（個人情報）を自動的に消去する。
