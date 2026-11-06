begin;
insert into public.vendors(id, shop_name) values ('11111111-1111-1111-1111-111111111111', '店A'), ('22222222-2222-2222-2222-222222222222', '店B');
insert into public.market_locations(id,store_number,latitude,longitude) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 11, 33.56, 133.53), ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 12, 33.56, 133.54);
insert into public.location_assignments(location_id,vendor_id,market_date) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','2026-11-01'),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','2026-11-15');
do $$
declare
  loc uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  other uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  item jsonb := jsonb_build_object('locationId',loc,'position',11,'lat',33.562,'lng',133.53,'vendorId','22222222-2222-2222-2222-222222222222');
  other_item jsonb := jsonb_build_object('locationId',other,'position',12,'lat',33.56,'lng',133.54);
begin
  perform public.save_map_layout(false, '[]', '[]', '[]', jsonb_build_array(item), '[]', '[]', '[]', '[]', null, '[]');
  if (select count(*) from public.location_assignments where location_id = loc) <> 2 then raise exception 'save deleted assignment history'; end if;
  if (select latitude from public.market_locations where id = loc) <> 33.562 then raise exception 'location was not updated'; end if;
  -- 保存時に意図しない店舗変更を拒否し、区画の更新もロールバックする。
  begin
    perform public.save_map_layout(false, '[]', '[]', '[]', jsonb_build_array(item || '{"lat":33.57,"vendorId":"11111111-1111-1111-1111-111111111111"}'::jsonb), '[]', '[]', '[]', '[]', null, '[]');
    raise exception 'assignment change was accepted';
  exception when check_violation then null; end;
  if (select latitude from public.market_locations where id = loc) <> 33.562 then raise exception 'failed edit was not rolled back'; end if;
  begin
    perform public.save_map_layout(false, '[]', '[]', '[]', '[]', '[]', '[]', '[]', '[]', null, '[{"id":"11111111-1111-1111-1111-111111111111","name":"変更"}]');
    raise exception 'vendor edit was accepted';
  exception when check_violation then null; end;
  if (select shop_name from public.vendors where id = '11111111-1111-1111-1111-111111111111') <> '店A' then raise exception 'vendor was modified'; end if;
  begin
    perform public.save_map_layout(false, '[]', '[]', '[]', '[]', '[]', jsonb_build_array(loc), '[]', '[]', null, '[]');
    raise exception 'deletion with history was accepted';
  exception when check_violation then null; end;
  -- スナップショット上の古い店舗を復元しても現行の配置履歴は変更しない。
  perform public.restore_map_layout_snapshot(jsonb_build_array(item || '{"lat":33.56,"vendorId":"11111111-1111-1111-1111-111111111111"}'::jsonb, other_item), '[]', '[]', null, null);
  if (select count(*) from public.location_assignments where location_id = loc) <> 2 then raise exception 'restore deleted assignment history'; end if;
  if (select latitude from public.market_locations where id = loc) <> 33.56 then raise exception 'location was not restored'; end if;
  begin
    perform public.restore_map_layout_snapshot(jsonb_build_array(other_item), '[]', '[]', null, null);
    raise exception 'restore deleted a location with history';
  exception when check_violation then null; end;
  if (select count(*) from public.location_assignments where location_id = loc) <> 2 then raise exception 'failed restore deleted history'; end if;
end $$;
rollback;
