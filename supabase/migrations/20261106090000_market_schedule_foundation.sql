-- 出店場所・店舗・予定の土台。既存の配置や住所は推測して書き換えない。
-- 既存画面からはまだ使用しない。切り替え時に現行データの確認と移行が必要。
create table public.market_place_memberships (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.market_locations(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  -- 住所の枝番ではなく、この場所の中で店舗を識別する番号。
  vendor_number integer check (vendor_number between 1 and 999999),
  created_at timestamptz not null default now(),
  unique (location_id, vendor_id),
  unique (id, location_id)
);
create unique index market_place_memberships_number_unique
  on public.market_place_memberships (location_id, vendor_number) where vendor_number is not null;
create index market_place_memberships_vendor_idx on public.market_place_memberships (vendor_id);

create table public.market_place_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.market_place_memberships(id) on delete restrict,
  cadence text not null check (cadence in ('weekly', 'fortnightly', 'monthly')),
  starts_on date not null check (extract(dow from starts_on) = 0),
  ends_on date check (ends_on is null or (extract(dow from ends_on) = 0 and ends_on >= starts_on)),
  -- 隔週の基準日。第1・3日曜とは異なるため、個別に保存する。
  anchor_on date,
  month_weeks smallint[],
  created_at timestamptz not null default now(),
  check (
    (cadence = 'weekly' and anchor_on is null and month_weeks is null)
    or (cadence = 'fortnightly' and anchor_on is not null and extract(dow from anchor_on) = 0 and month_weeks is null)
    or (cadence = 'monthly' and anchor_on is null and month_weeks is not null
      and cardinality(month_weeks) between 1 and 5
      and array_position(month_weeks, null) is null
      and month_weeks <@ array[1,2,3,4,5]::smallint[])
  )
);
create index market_place_schedule_rules_membership_idx on public.market_place_schedule_rules (membership_id);

-- その日だけ別の店舗にする場合と明示的な休み。未設定は行を作らない。
create table public.market_place_schedule_overrides (
  location_id uuid not null references public.market_locations(id) on delete restrict,
  market_date date not null check (extract(dow from market_date) = 0),
  membership_id uuid,
  created_at timestamptz not null default now(),
  primary key (location_id, market_date),
  foreign key (membership_id, location_id) references public.market_place_memberships(id, location_id) on delete restrict
);

alter table public.market_place_memberships enable row level security;
alter table public.market_place_schedule_rules enable row level security;
alter table public.market_place_schedule_overrides enable row level security;
revoke all on public.market_place_memberships, public.market_place_schedule_rules, public.market_place_schedule_overrides from public, anon, authenticated;
grant select, insert, update, delete on public.market_place_memberships, public.market_place_schedule_rules, public.market_place_schedule_overrides to service_role;
