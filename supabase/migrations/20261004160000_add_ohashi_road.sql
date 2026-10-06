-- 日曜市 7丁目の通り（大橋通り）を、マップ編集の道として用意する。
--
-- 7丁目は追手筋ではなく、追手筋と交差する大橋通り沿いに並ぶ。マップ編集の出店者 CSV 取り込みは、
-- 側が「大橋通り」の行を「大橋通り」という名前の道に置くため、その道を先に作っておく。
--
-- 形は OpenStreetMap（© OpenStreetMap contributors, ODbL）の道路データから取った。
-- 大橋通（歩行者道、way 126495760）の北の端＝7丁目の南の端から、名前の無い道
-- （way 126495753・764858920・93587150）をたどって、北の追手筋（way 93587121）に
-- ぶつかるまでの約120m。ここから先の細かい位置は、マップ編集の画面で点を動かして直す。
--
-- 種別は「出店可の通り」（区画分け・CSV 取り込みの対象）。道幅は狭い通りなので 20m にしている。
-- 「大橋通」を名前に含む道がすでにあれば何もしない（画面で先に作った場合・二重に当たった場合）。

do $$
declare
  v_base integer;
begin
  if exists (select 1 from map_roads where name like '%大橋通%') then
    return;
  end if;

  insert into map_roads (id, name, kind, width_meters)
  values ('ohashi-dori', '大橋通り', 'market', 20);

  -- 道の点は、既存の道の点の後ろに並べる（sort_order は道ごとにまとまった並びにする）
  select coalesce(max(sort_order), -1) + 1 into v_base from map_route_points;

  insert into map_route_points (id, latitude, longitude, sort_order, road_id)
  values
    ('ohashi-dori-p0', 33.56005, 133.53612, v_base + 0, 'ohashi-dori'),
    ('ohashi-dori-p1', 33.56008, 133.53611, v_base + 1, 'ohashi-dori'),
    ('ohashi-dori-p2', 33.56012, 133.53610, v_base + 2, 'ohashi-dori'),
    ('ohashi-dori-p3', 33.56089, 133.53589, v_base + 3, 'ohashi-dori'),
    ('ohashi-dori-p4', 33.56099, 133.53587, v_base + 4, 'ohashi-dori'),
    ('ohashi-dori-p5', 33.56111, 133.53584, v_base + 5, 'ohashi-dori');
end;
$$;
