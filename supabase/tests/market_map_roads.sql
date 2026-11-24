begin;

-- 保存 RPC で新しい市場の道・区画を登録し、区画が同じ市場に属することを確認する。
do $$
declare
  thu uuid := (select id from public.markets where slug = 'mokuyo');
  roads jsonb := jsonb_build_array(jsonb_build_object('id','test-mokuyo-road','name','県庁前通り','kind','market','widthMeters',22,'marketId',thu));
  points jsonb := '[{"id":"test-mokuyo-start","latitude":33.556,"longitude":133.529,"sort_order":0,"road_id":"test-mokuyo-road"},{"id":"test-mokuyo-end","latitude":33.556,"longitude":133.533,"sort_order":1,"road_id":"test-mokuyo-road"}]';
  shops jsonb := '[{"locationId":"new-market-map-test","position":90001,"lat":33.5561,"lng":133.531,"roadId":"test-mokuyo-road","roadDistanceM":180,"roadSide":"left","roadOffsetM":8}]';
begin
  if exists (select 1 from public.map_roads where market_id <> public.default_market_id()) then
    raise exception 'existing roads must belong to Sunday market';
  end if;
  perform public.save_map_layout(true, roads, points, '[]', shops, '[]', '[]', '[]', '[]', null);
  if (select market_id from public.market_locations where store_number = 90001) is distinct from thu then
    raise exception 'market location did not inherit its road market';
  end if;
  -- 旧形式の保存は、既存の道の市を上書きしない。
  perform public.save_map_layout(true, jsonb_build_array((roads->0) - 'marketId'), points, '[]', '[]', '[]', '[]', '[]', '[]', null);
  if (select market_id from public.map_roads where id = 'test-mokuyo-road') is distinct from thu then
    raise exception 'old client reset road market';
  end if;
  begin
    update public.map_roads set market_id = public.default_market_id() where id = 'test-mokuyo-road';
    raise exception 'road with a market location changed markets';
  exception when foreign_key_violation then null;
  end;
end $$;

set local role anon;
do $$ begin
  if exists (select 1 from public.map_roads where id = 'test-mokuyo-road') or
     exists (select 1 from public.map_route_points where id = 'test-mokuyo-start') or
     exists (select 1 from public.market_locations where store_number = 90001) then
    raise exception 'private market map data is visible to visitors';
  end if;
end $$;
reset role;

update public.markets set is_public = true where slug = 'mokuyo';
set local role anon;
do $$ begin
  if not exists (select 1 from public.map_roads where id = 'test-mokuyo-road') or
     not exists (select 1 from public.map_route_points where id = 'test-mokuyo-start') or
     not exists (select 1 from public.market_locations where store_number = 90001) then
    raise exception 'public market map data is missing';
  end if;
end $$;
reset role;
rollback;
