-- 日曜市の丁目の境目を、実際の交差点の座標で持てるようにする (2/4)。
--
-- 境目は交差点の緯度経度（点）で持つ。道への投影は、判定のたびにコード側（lib/map/chomeBoundaries.ts）で行う
-- ので、道の形を直しても境目の位置は道についてくる。道の向き（始点が東か西か）にも左右されない。
-- 丁目は chome_sections で「どの道の、どの境目からどの境目まで」かを決める。
--
-- 座標は OpenStreetMap（© OpenStreetMap contributors, ODbL）の追手筋・南側車線（way 93587133）と、
-- 交わる道が重なる点。実際の日曜市の運用と少しずれる可能性があるので、値は後から直せるデータにしてある。
-- 「確かさ」が needs_review の境目は、管理画面で印を付けて見せる（廿代通りは OSM に名前がなく推定）。
--
-- 7丁目（大橋通り）は、B5 の交差点から大橋通りを南へ延びる区間。境目が B5 の1つだけなので、
-- B5 から遠いほうの道の端（南端）までを区間にする。南端は未確定で、道の点を動かして直す。
--
-- 区画に chome_locked を足す。手で設定した丁目（144番のような例外）は、自動判定で上書きしない。
-- 書き込みは service_role のみ（chomes と同じ）。

create table if not exists public.chome_boundaries (
  id         text primary key,
  name       text not null,                    -- 交差点名
  latitude   double precision not null,
  longitude  double precision not null,
  confidence text not null default 'confirmed' check (confidence in ('confirmed', 'needs_review')),
  sort_order smallint not null unique
);

comment on table public.chome_boundaries is
  '丁目の境目（交差点の緯度経度）。道への投影はコードで行う。書き込みは service_role のみ。';

create table if not exists public.chome_sections (
  chome_id         smallint primary key references public.chomes (id),
  road_id          text not null references public.map_roads (id) on delete cascade,
  from_boundary_id text references public.chome_boundaries (id),
  to_boundary_id   text references public.chome_boundaries (id)
);

comment on table public.chome_sections is
  '丁目の区間: どの道の、どの境目からどの境目まで。境目が null の側は道の端まで（片方だけなら、境目から遠い側の端まで）。';

insert into public.chome_boundaries (id, name, latitude, longitude, confidence, sort_order)
values
  ('E',  '駅前電車通り（東端）', 33.562196, 133.543152, 'confirmed',    1),
  ('B1', '廿代通り',             33.562119, 133.541219, 'needs_review', 2),
  ('B2', 'グリーンロード',       33.561962, 133.540289, 'confirmed',    3),
  ('B3', '堀詰通り',             33.561720, 133.539025, 'confirmed',    4),
  ('B4', '中の橋通り',           33.561444, 133.537658, 'confirmed',    5),
  ('B5', '大橋通り',             33.560988, 133.535868, 'confirmed',    6),
  ('W',  '追手門前（西端）',     33.560444, 133.533713, 'confirmed',    7)
on conflict (id) do nothing;

-- 追手筋は 'main'。7丁目の道は、'ohashi-dori'（add_ohashi_road のマイグレーションで作る道）か、名前に「大橋通」を含む道
-- （add_ohashi_road は、名前に「大橋通」を含む道がすでにあれば何もしないので、画面で先に作った道は id が違う）。
-- 道がまだない環境（まっさらな DB など）では、その丁目の区間だけ作らず、作れなかった丁目を notice で知らせる。
-- あとで道ができたら、このマイグレーションを流し直せば区間が足される（作った区間は上書きしない）。
insert into public.chome_sections (chome_id, road_id, from_boundary_id, to_boundary_id)
select v.chome_id, v.road_id, v.from_id, v.to_id
from (values
  (1::smallint, 'main', 'E',  'B1'),
  (2::smallint, 'main', 'B1', 'B2'),
  (3::smallint, 'main', 'B2', 'B3'),
  (4::smallint, 'main', 'B3', 'B4'),
  (5::smallint, 'main', 'B4', 'B5'),
  (6::smallint, 'main', 'B5', 'W'),
  (7::smallint,
   (select r.id from public.map_roads r
     where r.id = 'ohashi-dori' or r.name like '%大橋通%'
     order by (r.id = 'ohashi-dori') desc, r.id
     limit 1),
   'B5', null)
) as v(chome_id, road_id, from_id, to_id)
where exists (select 1 from public.map_roads r where r.id = v.road_id)
on conflict (chome_id) do nothing;

do $$
declare
  r record;
begin
  for r in
    select c.id from public.chomes c
    where not exists (select 1 from public.chome_sections s where s.chome_id = c.id)
    order by c.id
  loop
    raise notice '丁目の区間を作れませんでした: % 丁目（道が見つかりません。道を作ってから、このマイグレーションを流し直してください）', r.id;
  end loop;
end;
$$;

alter table public.chome_boundaries enable row level security;
alter table public.chome_sections enable row level security;
revoke all on public.chome_boundaries, public.chome_sections from anon, authenticated;
grant select on public.chome_boundaries, public.chome_sections to anon, authenticated;

drop policy if exists "public read chome_boundaries" on public.chome_boundaries;
create policy "public read chome_boundaries"
  on public.chome_boundaries for select using (true);

drop policy if exists "public read chome_sections" on public.chome_sections;
create policy "public read chome_sections"
  on public.chome_sections for select using (true);

-- 手で設定した丁目は、自動判定で上書きしない
alter table public.market_locations
  add column if not exists chome_locked boolean not null default false;

comment on column public.market_locations.chome_locked is
  'true なら丁目を手で設定した区画。道の位置からの自動判定で上書きしない。';
