-- 市（マーケット）の土台。
-- 日曜市を初期行として登録し、市に関係するテーブルに market_id を足す。
-- 既存の行はすべて日曜市に紐づけ、既存の表示は変えない。
-- 木曜市は非公開（is_public = false）で登録し、公開するまで画面に出さない。
-- 開催曜日は今は1つの曜日（weekday）だけ持つ。複数曜日への拡張は次の段階で行う。

create table if not exists public.markets (
  id         uuid        primary key default gen_random_uuid(),
  slug       text        not null unique check (slug ~ '^[a-z][a-z0-9-]{1,31}$'),
  name       text        not null check (char_length(name) between 1 and 40),
  -- 0=日 1=月 ... 6=土（PostgreSQL の extract(dow) と同じ）
  weekday    smallint    not null check (weekday between 0 and 6),
  is_public  boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.markets is '市（日曜市・木曜市など）。is_public が true の市だけ一般に見える。';
comment on column public.markets.slug is '公開URLに使う名前（例: mokuyo）';
comment on column public.markets.weekday is '開催曜日（0=日〜6=土）';

insert into public.markets (slug, name, weekday, is_public)
values
  ('nichiyo', '日曜市', 0, true),
  ('mokuyo',  '木曜市', 4, false)
on conflict (slug) do nothing;

-- 既定の市（日曜市）のID。市IDを省略して入れた行は日曜市になる。
-- 既存の画面のコードは market_id を送らないため、この既定値で日曜市に入る。
create or replace function public.default_market_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.markets where slug = 'nichiyo'
$$;

revoke all on function public.default_market_id() from public;
grant execute on function public.default_market_id() to anon, authenticated, service_role;

alter table public.markets enable row level security;

-- 公開されている市は誰でも見られる。非公開の市は管理者だけが見られる。
create policy "markets_select_public_or_admin"
  on public.markets for select
  using (
    is_public
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- 作成・更新・削除は管理者のみ
create policy "markets_insert_admin"
  on public.markets for insert
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create policy "markets_update_admin"
  on public.markets for update
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create policy "markets_delete_admin"
  on public.markets for delete
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

grant select on public.markets to anon, authenticated;

-- 市IDを足す。既存の行は default_market_id() で日曜市になる（add column 時に既定値が入る）。
alter table public.market_days
  add column if not exists market_id uuid references public.markets(id) on delete restrict default public.default_market_id();
update public.market_days set market_id = public.default_market_id() where market_id is null;
alter table public.market_days alter column market_id set not null;

alter table public.market_events
  add column if not exists market_id uuid references public.markets(id) on delete restrict default public.default_market_id();
update public.market_events set market_id = public.default_market_id() where market_id is null;
alter table public.market_events alter column market_id set not null;

alter table public.market_locations
  add column if not exists market_id uuid references public.markets(id) on delete restrict default public.default_market_id();
update public.market_locations set market_id = public.default_market_id() where market_id is null;
alter table public.market_locations alter column market_id set not null;

create index if not exists market_days_market_id_idx on public.market_days(market_id);
create index if not exists market_events_market_id_idx on public.market_events(market_id);
create index if not exists market_locations_market_id_idx on public.market_locations(market_id);
