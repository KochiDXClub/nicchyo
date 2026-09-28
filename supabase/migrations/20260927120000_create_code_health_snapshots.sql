-- コード健康診断のスナップショット履歴（管理画面 /admin/code-health）
--
-- 書き込みは CI（main への push）から service role のみで行う。
-- ここに「誰でも INSERT できる」ポリシーは意図的に置かない
-- （20260911220100 で他のログ系テーブルを絞った方針と同じ）。
-- service role は RLS 自体をバイパスするため、書き込み用ポリシーは不要。

create table if not exists code_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  commit text not null,
  branch text not null,
  summary jsonb not null,
  files jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists code_health_snapshots_created_at_idx
on code_health_snapshots (created_at desc);

alter table code_health_snapshots enable row level security;

-- 匿名・認証ユーザーへの既定権限を絞る（RLS 1枚に頼らない）
revoke all on code_health_snapshots from anon, authenticated;
grant select on code_health_snapshots to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'code_health_snapshots'
      and policyname = 'admins read code health snapshots'
  ) then
    create policy "admins read code health snapshots"
    on code_health_snapshots
    for select
    using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  end if;
end $$;
