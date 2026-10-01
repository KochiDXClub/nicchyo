-- 出店者トップのにちよさんへの相談（/api/vendor/help-chat）の記録と、使うAIモデルの台帳行。
--
-- 1. vendor_help_logs: 出店者が聞いたことと、にちよさんの答えを残す。
--    よくある質問を見つけて、使い方ガイド（lib/vendor/helpGuide.ts）や画面を直すために使う。
--    来訪者の相談（ai_consult_logs）は質問文を残さないが、こちらは相手が出店者本人で、
--    運営が困りごとを把握するための記録なので、質問文と答えをそのまま残す。
--
--    書き込みは API から service role だけで行う（出店者のブラウザからは書かせない）。
--    service role は RLS をバイパスするので、書き込み用のポリシーは置かない。
--    読めるのは管理者だけ（20260927120000 の code_health_snapshots と同じ形）。
--
-- 2. ai_use_cases に 'vendorHelp' を足し、管理画面から使うモデルを選べるようにする。
--    行が無くてもコード側の既定値（lib/ai/models.ts）で動く。

create table if not exists public.vendor_help_logs (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  question text not null,
  answer text not null default '',
  created_at timestamptz not null default now(),

  constraint vendor_help_logs_question_length check (char_length(question) between 1 and 1000),
  constraint vendor_help_logs_answer_length check (char_length(answer) <= 4000)
);

create index if not exists vendor_help_logs_created_at_idx
  on public.vendor_help_logs (created_at desc);
create index if not exists vendor_help_logs_vendor_id_idx
  on public.vendor_help_logs (vendor_id, created_at desc);

alter table public.vendor_help_logs enable row level security;

-- 既定で付く全権限（TRUNCATE を含む）をいったん剥がし、管理者の読み取りに要る分だけ付け直す
revoke all on public.vendor_help_logs from anon, authenticated;
grant select on public.vendor_help_logs to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'vendor_help_logs'
      and policyname = 'admins read vendor help logs'
  ) then
    create policy "admins read vendor help logs"
    on public.vendor_help_logs
    for select to authenticated
    using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  end if;
end $$;

comment on table public.vendor_help_logs is
  '出店者トップのにちよさんへの相談の記録。書き込みは /api/vendor/help-chat（service role）のみ、読み取りは管理者のみ。';

insert into ai_use_cases (key, label, description, sort_order) values
  (
    'vendorHelp',
    '出店者の相談（にちよさん）',
    '出店者トップで、出店者がアプリの使い方を聞くヘルプデスク。使い方ガイドとその店の登録内容を元に、200文字程度で答える。',
    50
  )
on conflict (key) do nothing;

-- ── 保存期間: 定期パージに vendor_help_logs を足す ─────────────────────────
-- 出店者が自由に書いた相談文を、期限なしで持ち続けないようにする。
-- 最新定義（20260911220000_drop_ai_consult_log_question_and_ip.sql）に
-- vendor_help_logs の削除を1つ足しただけで、他の処理は変えていない。
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
