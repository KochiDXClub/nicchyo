-- CI のマイグレーション適用済み隔離 DB で実行。変更はすべてロールバックする。
begin;
do $$
declare
  v uuid := 'f1000000-0000-4000-8000-000000000001';
  loc uuid := 'f2000000-0000-4000-8000-000000000001';
  actor uuid := 'f3000000-0000-4000-8000-000000000001';
  expected timestamptz; result jsonb; has_legacy_guard boolean;
begin
  insert into public.market_locations(id,store_number,latitude,longitude,place_name)
    values (loc,99005,33.56,133.53,'原子性テスト');
  insert into public.vendors(id,shop_name,market_place_id) values (v,'元の店',loc) returning updated_at into expected;
  select exists(select 1 from pg_catalog.pg_trigger where tgname = 'check_field_location_shared_place' and not tgisinternal) into has_legacy_guard;
  if has_legacy_guard then
    result := public.admin_edit_shop_with_chome(v,expected,'{"shop_name":"新しい店"}',true,'店主',3::smallint,actor);
    if result->>'status' <> 'shared_place' then raise exception 'shared-place edit was accepted: %', result; end if;
    if (select shop_name from public.vendors where id=v) <> '元の店'
      or exists(select 1 from public.field_shop_locations where vendor_id=v)
      or exists(select 1 from public.vendor_owner_profiles where vendor_id=v) then raise exception 'partial update'; end if;
    update public.vendors set market_place_id=null where id=v returning updated_at into expected;
  end if;
  result := public.admin_edit_shop_with_chome(v,expected,'{"shop_name":"新しい店","main_products":["りんご"]}',true,'店主',3::smallint,actor);
  if result->>'status' <> 'ok' or (select shop_name from public.vendors where id=v) <> '新しい店'
    or (select main_products from public.vendors where id=v) <> array['りんご']
    or (select chome_id from public.field_shop_locations where vendor_id=v) <> 3
    or (select owner_name from public.vendor_owner_profiles where vendor_id=v) <> '店主' then raise exception 'atomic update failed: %', result; end if;
  result := public.admin_edit_shop_with_chome(v,expected - interval '1 second','{"shop_name":"古い更新"}',false,null,3::smallint,actor);
  if result->>'status' <> 'stale' or (select shop_name from public.vendors where id=v) <> '新しい店' then raise exception 'stale edit was accepted'; end if;
  if has_function_privilege('authenticated','public.admin_edit_shop_with_chome(uuid,timestamptz,jsonb,boolean,text,smallint,uuid)','execute') then raise exception 'public rpc'; end if;
end $$;
rollback;
