-- 個人情報（IPアドレス）の保持期限を設け、期限切れデータを毎日自動でNULL化/削除する
--
-- 背景:
--   ai_consult_logs / shop_interactions / ai_abuse_blocks / ai_abuse_events /
--   admin_audit_logs は来訪者・操作者の生IPアドレスを無期限に保持していた。
--   各テーブルのIPを実際に参照している処理は以下のとおりで、
--   それを超える期間の保持はデータ最小化の原則（ISMS）に反する。
--
--   - ai_consult_logs.ip_address : レートリミット判定（直近1時間のみ参照）
--   - shop_interactions.ip_address : 週次セキュリティレポート（直近1週間のみ参照）
--   - ai_abuse_blocks.ip_address : ブロック照合（is_active = true の間のみ参照）
--   - ai_abuse_events            : 不正利用イベントの調査用ログ
--   - admin_audit_logs.ip_address : インシデント調査用の監査証跡
--
-- 保持期限（期限超過後の扱い）:
--   - ai_consult_logs.ip_address  : 30日（列のみNULL化。相談ログ本体は統計用に残す）
--   - shop_interactions.ip_address: 8日（列のみNULL化。週次レポート生成後は不要）
--   - ai_abuse_blocks             : 解除(is_active=false)から90日で ip_address/visitor_key をNULL化
--   - ai_abuse_events             : 90日で行削除
--   - admin_audit_logs.ip_address : 365日（列のみNULL化。監査証跡本体は残す）

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
end;
$$;

-- クライアントからは実行不可（pg_cron / service role のみ）
revoke execute on function public.purge_expired_personal_data() from public;
revoke execute on function public.purge_expired_personal_data() from anon;
revoke execute on function public.purge_expired_personal_data() from authenticated;

-- pg_cron で毎日 18:00 UTC（日本時間 3:00）に実行する。
-- ローカル開発環境など pg_cron が使えない環境ではスケジュール登録をスキップし、
-- 関数のみ作成する（手動実行: select public.purge_expired_personal_data();）
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    -- 同名ジョブがあれば置き換え
    perform cron.unschedule(jobid)
      from cron.job
     where jobname = 'purge-expired-personal-data';

    perform cron.schedule(
      'purge-expired-personal-data',
      '0 18 * * *',
      'select public.purge_expired_personal_data()'
    );
  else
    raise notice 'pg_cron is not available; run public.purge_expired_personal_data() manually or via an external scheduler';
  end if;
end $$;

-- 目的: 生IPアドレスの無期限保持をやめ、用途ごとに定めた保持期限で自動的に消去する。
