-- マップ編集の「道」を、名前・種別（出店可の通り/一般道/歩道）・幅を持つ
-- 独立したエンティティとして扱えるようにする。
-- 既存の map_route_points（分岐込みの単一連続ルート）はそのまま活かし、
-- road_id で map_roads に紐づける。

create table if not exists map_roads (
  id text primary key,
  name text not null,
  kind text not null default 'street' check (kind in ('market', 'street', 'path')),
  width_meters double precision not null default 26,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table map_roads enable row level security;

-- RLSポリシーだけでは anon/authenticated から読めないため、明示的にGRANTする
-- （PostgRESTはテーブルGRANTとRLSの両方を要求する）
GRANT SELECT ON public.map_roads TO anon;
GRANT SELECT ON public.map_roads TO authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'map_roads'
      and policyname = 'public read map_roads'
  ) then
    create policy "public read map_roads"
    on map_roads
    for select
    using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'map_roads'
      and policyname = 'admin manage map_roads'
  ) then
    create policy "admin manage map_roads"
    on map_roads
    for all
    using (
      exists (
        select 1 from vendors
        where vendors.id = auth.uid()
        and vendors.role = 'admin'
      )
    )
    with check (
      exists (
        select 1 from vendors
        where vendors.id = auth.uid()
        and vendors.role = 'admin'
      )
    );
  end if;
end $$;

alter table map_route_points
add column if not exists road_id text references map_roads(id) on delete cascade;

create index if not exists map_route_points_road_id_idx
on map_route_points (road_id);

-- 既存の route_points を1本の「出店可の通り」として map_roads にバックフィルする。
-- 幅は既存の map_route_configs.road_half_width_meters（半径）の2倍を採用する。
insert into map_roads (id, name, kind, width_meters)
select
  'main',
  '追手筋',
  'market',
  coalesce(
    (select road_half_width_meters from map_route_configs where key = 'default'),
    15.6
  ) * 2
where exists (select 1 from map_route_points)
on conflict (id) do nothing;

update map_route_points
set road_id = 'main'
where road_id is null;

-- スナップショット（変更履歴）にも道の情報を含められるようにする。
-- NOT NULLにせず、既存行はNULLのまま残す（「roads未対応の古いスナップショット」を
-- 「保存時点で道が0件だった」という明示的な空配列と区別するため。
-- restore_map_layout_snapshot 側の扱いは同マイグレーション内のコメントを参照）
alter table map_layout_snapshots
add column if not exists roads_json jsonb;
