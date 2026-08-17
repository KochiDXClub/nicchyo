-- ページ解析の行レベル行動ログを日次サマリー＋短期保持に置き換える
--
-- 背景:
--   web_page_analytics は visitor_key × 閲覧ページ × 滞在時間の行レベル記録を
--   無期限に蓄積しており、結合すると訪問者単位の行動プロファイルが組める。
--   実際の利用は
--     - 管理ダッシュボード: 日次ユニーク訪問者数の推移（最長5年）
--     - 管理解析ページ: 過去30日の集計
--     - 週次セキュリティレポート: 過去7日
--   のみで、長期に必要なのは「日ごとの人数」だけ。
--   また user_id 列は書き込まれるだけで読む処理が存在しない。
--
-- 対策:
--   1. 日次サマリーテーブル web_page_daily_summaries を新設し、
--      長期の推移表示はこちらで賄う（visitor_key を含まない）
--   2. 生ログは35日で削除（30日集計＋週次レポートをカバー）
--   3. 誰も読まない user_id 列を削除

-- ── 日次サマリー ──────────────────────────────────────────────────────
create table if not exists public.web_page_daily_summaries (
  visit_date             date primary key,
  unique_visitors        integer not null default 0,  -- 管理者を除く日次ユニーク訪問者数
  vendor_unique_visitors integer not null default 0,  -- 出店者ロールの日次ユニーク訪問者数
  updated_at             timestamptz not null default now()
);

alter table public.web_page_daily_summaries enable row level security;

drop policy if exists "admins read page daily summaries" on public.web_page_daily_summaries;
create policy "admins read page daily summaries"
  on public.web_page_daily_summaries
  for select
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role')
    in ('admin', 'super_admin')
  );

grant select on public.web_page_daily_summaries to authenticated;

-- ── 集計関数 ──────────────────────────────────────────────────────────
-- 生ログに存在する日だけを対象に upsert するため、
-- 生ログ削除後に過去日のサマリーが低い値で上書きされることはない。
create or replace function public.aggregate_web_page_daily_summaries()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.web_page_daily_summaries
    (visit_date, unique_visitors, vendor_unique_visitors, updated_at)
  select
    visit_date,
    count(distinct visitor_key) filter (
      where coalesce(user_role, '') not in ('admin', 'super_admin')
    ),
    count(distinct visitor_key) filter (where user_role = 'vendor'),
    now()
  from public.web_page_analytics
  group by visit_date
  on conflict (visit_date) do update
    set unique_visitors        = excluded.unique_visitors,
        vendor_unique_visitors = excluded.vendor_unique_visitors,
        updated_at             = now();
end;
$$;

revoke execute on function public.aggregate_web_page_daily_summaries() from public;
revoke execute on function public.aggregate_web_page_daily_summaries() from anon;
revoke execute on function public.aggregate_web_page_daily_summaries() from authenticated;

-- 既存の生ログをサマリーへバックフィル（過去分の推移表示を維持する）
select public.aggregate_web_page_daily_summaries();

-- 誰も読んでいない user_id 列を削除
alter table public.web_page_analytics drop column if exists user_id;

-- ── purge に集計＋35日削除を追加 ──────────────────────────────────────
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

  -- ページ解析: 日次サマリーへ集計してから、生ログを35日で削除
  perform public.aggregate_web_page_daily_summaries();
  delete from public.web_page_analytics
   where visit_date < (now() at time zone 'Asia/Tokyo')::date - 35;
end;
$$;

-- 既存の35日超の生ログもこの場で削除する（サマリーは上でバックフィル済み）
delete from public.web_page_analytics
 where visit_date < (now() at time zone 'Asia/Tokyo')::date - 35;

-- 目的: 長期保存を「日ごとの人数」だけにし、訪問者単位の行動記録は35日で消す。
