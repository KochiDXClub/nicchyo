create table public.embedding_sync_runs (
  id uuid primary key default gen_random_uuid(),
  target text not null check (target in ('vendors', 'knowledge')),
  source text not null check (source in ('manual', 'scheduled', 'script')),
  actor_id uuid,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'interrupted')),
  processed_count integer check (processed_count >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  check ((source = 'manual') = (actor_id is not null)),
  check ((status = 'running') = (finished_at is null)),
  check ((status in ('succeeded', 'failed')) = (processed_count is not null))
);

create unique index embedding_sync_runs_one_running_per_target
  on public.embedding_sync_runs (target) where status = 'running';

create index embedding_sync_runs_recent
  on public.embedding_sync_runs (started_at desc, id desc);

alter table public.embedding_sync_runs enable row level security;
revoke all on table public.embedding_sync_runs from public, anon, authenticated, service_role;
grant select, insert, update on table public.embedding_sync_runs to service_role;
