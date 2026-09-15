-- マップ描画パフォーマンスの計測結果ログ
--
-- /admin/map-perf（管理画面の計測ページ）と scripts/map-bench.mjs（CLI）が
-- 計測結果を保存する。どのブランチ・コミット・環境で取った数字かを一緒に持ち、
-- 描画方式を変えたときの前後比較や推移グラフに使う。
--
-- 生の計測レポートは report（jsonb）にそのまま入れる。
-- 指標の抽出はアプリ側（lib/perf/metrics.ts）で行い、DB には要約カラムを持たない
-- （指標の定義を後から増やしても過去のログを再集計できるようにするため）。

create table if not exists public.map_perf_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  -- 人が付けるラベル（例: 「SVG 化後」）
  label text not null default '',

  -- どのコードで計測したか
  branch text not null default '',
  commit_sha text not null default '',
  -- local | preview | production | cli
  environment text not null default 'unknown',
  deployment_url text not null default '',

  -- 計測条件
  viewport_width integer not null default 0,
  viewport_height integer not null default 0,
  device_pixel_ratio real not null default 1,
  shop_count integer not null default 0,
  cpu_throttle real not null default 1,
  user_agent text not null default '',

  -- 生の計測レポート（lib/perf/mapBenchmark.ts の BenchmarkReport）
  report jsonb not null,

  constraint map_perf_runs_label_len check (char_length(label) <= 200),
  constraint map_perf_runs_branch_len check (char_length(branch) <= 200),
  constraint map_perf_runs_sha_len check (char_length(commit_sha) <= 64),
  constraint map_perf_runs_env_len check (char_length(environment) <= 32),
  constraint map_perf_runs_url_len check (char_length(deployment_url) <= 500)
);

create index if not exists map_perf_runs_created_at_idx
  on public.map_perf_runs (created_at desc);

create index if not exists map_perf_runs_branch_created_at_idx
  on public.map_perf_runs (branch, created_at desc);

-- RLS: 管理者のみ閲覧・保存・削除できる
-- 管理者判定は JWT の app_metadata.role（lib/auth/permissions.ts と同じ基準）
alter table public.map_perf_runs enable row level security;

drop policy if exists "admins select map perf runs" on public.map_perf_runs;
create policy "admins select map perf runs"
  on public.map_perf_runs
  for select
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

drop policy if exists "admins insert map perf runs" on public.map_perf_runs;
create policy "admins insert map perf runs"
  on public.map_perf_runs
  for insert
  to authenticated
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

drop policy if exists "admins delete map perf runs" on public.map_perf_runs;
create policy "admins delete map perf runs"
  on public.map_perf_runs
  for delete
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

grant select, insert, delete on public.map_perf_runs to authenticated;

-- 目的: マップ描画の計測結果を、ブランチ・コミット・環境・計測条件と一緒に蓄積し、
--       描画方式の変更前後を数値とグラフで比較できるようにする。
