-- 店舗情報と現場で聞いた丁目を一つのトランザクションにする。
-- 共通場所の登録と競合して丁目が拒否された場合、店舗情報も更新しない。
create function public.admin_edit_shop_with_chome(
  p_vendor_id uuid, p_expected_updated_at timestamptz, p_patch jsonb,
  p_owner_set boolean, p_owner_name text, p_chome smallint, p_actor uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_updated_at timestamptz;
  v_columns text;
  v_key text;
begin
  if p_vendor_id is null or p_actor is null or p_chome is null or p_chome not between 1 and 7
     or p_owner_set is null or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    return jsonb_build_object('status', 'invalid');
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key <> all (array['shop_name','category_id','style','strength','main_products','main_product_prices','payment_methods','rain_policy','sns_instagram','sns_x','sns_hp','business_hours_start','business_hours_end','shop_image_url','shop_image_kind','listing_status','photo_use_allowed','listing_consented_on','listing_consent_note']) then
      return jsonb_build_object('status', 'invalid');
    end if;
  end loop;
  select updated_at into v_updated_at from public.vendors where id = p_vendor_id for update;
  if not found then return jsonb_build_object('status', 'missing'); end if;
  if v_updated_at is distinct from p_expected_updated_at then return jsonb_build_object('status', 'stale'); end if;

  begin
    insert into public.field_shop_locations(vendor_id,chome_id,updated_by,updated_at)
      values (p_vendor_id,p_chome,p_actor,clock_timestamp())
      on conflict (vendor_id) do update set chome_id = excluded.chome_id, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  exception when check_violation then
    if sqlerrm = 'vendor_has_shared_market_place' then return jsonb_build_object('status', 'shared_place'); end if;
    raise;
  end;
  if p_owner_set then
    insert into public.vendor_owner_profiles(vendor_id,owner_name) values (p_vendor_id,p_owner_name)
      on conflict (vendor_id) do update set owner_name = excluded.owner_name;
  end if;
  select string_agg(format('%1$I = (jsonb_populate_record(null::public.vendors, $1)).%1$I', key), ', ')
    into v_columns from jsonb_object_keys(p_patch) as keys(key);
  execute format('update public.vendors set %s updated_at = clock_timestamp() where id = $2 returning updated_at',
    case when v_columns is null then '' else v_columns || ', ' end)
    into v_updated_at using p_patch, p_vendor_id;
  return jsonb_build_object('status', 'ok', 'updated_at', v_updated_at);
end $$;
revoke all on function public.admin_edit_shop_with_chome(uuid,timestamptz,jsonb,boolean,text,smallint,uuid) from public, anon, authenticated;
grant execute on function public.admin_edit_shop_with_chome(uuid,timestamptz,jsonb,boolean,text,smallint,uuid) to service_role;
