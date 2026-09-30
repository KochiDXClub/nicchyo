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
