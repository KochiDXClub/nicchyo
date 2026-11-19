-- 出店場所は地図上の区画を参照する。既存店舗の場所は推測せず未設定のままにする。
alter table public.market_locations add column place_name text;
alter table public.market_locations add constraint market_locations_place_name_valid
  check (place_name is null or (char_length(btrim(place_name)) between 1 and 100 and regexp_replace(normalize(place_name, NFKC), '[[:space:]　]+', '', 'g') <> ''));
-- 全角・半角および空白の違いで、同じ名前の場所が複数できないようにする。
create unique index market_locations_place_name_unique
  on public.market_locations (lower(regexp_replace(normalize(place_name, NFKC), '[[:space:]　]+', '', 'g')))
  where place_name is not null;
alter table public.vendors add column market_place_id uuid references public.market_locations(id) on delete restrict;
create index vendors_market_place_id_idx on public.vendors(market_place_id) where market_place_id is not null;
comment on column public.market_locations.place_name is '日曜市内の出店場所名。地図上の位置はこの区画で一元管理する。';
comment on column public.vendors.market_place_id is '店舗が登録した出店場所。複数店舗が同じ区画を参照できる。';

-- 地図編集など既存の書き込み経路からも、別の場所への割当を防ぐ。
create function public.check_vendor_place_assignment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_place uuid; v_name text;
begin
  select market_place_id into v_place from public.vendors where id = new.vendor_id for share;
  select place_name into v_name from public.market_locations where id = new.location_id for share;
  if v_name is not null and v_place is null then
    raise exception 'vendor_market_place_unregistered' using errcode = '23514';
  end if;
  if v_place is not null and v_place <> new.location_id then
    raise exception 'vendor_market_place_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger check_vendor_place_assignment before insert or update of vendor_id, location_id
  on public.location_assignments for each row execute function public.check_vendor_place_assignment();

-- 場所への紐付けと重複確認をひとつのトランザクションで行う。
create function public.set_vendor_market_place(p_vendor uuid, p_location uuid, p_name text, p_confirm boolean, p_expected_updated_at timestamptz, p_expected_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_name text; v_other integer; v_existing uuid; v_assigned uuid; v_old_place uuid; v_updated_at timestamptz; v_promoted uuid[];
begin
  select market_place_id, updated_at into v_old_place, v_updated_at from public.vendors where id = p_vendor for update;
  if not found then return jsonb_build_object('status', 'vendor_missing'); end if;
  if v_updated_at is distinct from p_expected_updated_at then return jsonb_build_object('status', 'stale_vendor'); end if;
  if p_location is null then
    -- 地図の配置から場所が決まっている間は、ここだけを消しても復活してしまう。
    select ml.place_name into v_name from public.location_assignments la
      join public.market_locations ml on ml.id = la.location_id
      where la.vendor_id = p_vendor order by la.market_date desc, la.created_at desc nulls last, la.id desc limit 1;
    if v_name is not null then return jsonb_build_object('status', 'map_assignment_exists'); end if;
    update public.vendors set market_place_id = null where id = p_vendor returning updated_at into v_updated_at;
    return jsonb_build_object('status', 'ok', 'updatedAt', v_updated_at);
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 100 then
    return jsonb_build_object('status', 'invalid_name');
  end if;
  select place_name into v_name from public.market_locations where id = p_location for update;
  if not found then return jsonb_build_object('status', 'location_missing'); end if;
  -- 一覧表示後に名前が変わったら、変更を上書きせず再読込を求める。
  if v_name is distinct from p_expected_name then return jsonb_build_object('status', 'place_name_changed'); end if;
  select id into v_existing from public.market_locations
    where place_name is not null and id <> p_location
      and lower(regexp_replace(normalize(place_name, NFKC), '[[:space:]　]+', '', 'g')) =
          lower(regexp_replace(normalize(p_name, NFKC), '[[:space:]　]+', '', 'g')) limit 1;
  if v_existing is not null then return jsonb_build_object('status', 'name_in_use', 'locationId', v_existing); end if;
  -- 現在地図で使用されている別区画と矛盾する登録は拒否する。
  select location_id into v_assigned from public.location_assignments
    where vendor_id = p_vendor order by market_date desc, created_at desc nulls last, id desc limit 1;
  if v_assigned is not null and v_assigned <> p_location then
    return jsonb_build_object('status', 'existing_assignment_mismatch');
  end if;
  if v_name is not null and v_name <> btrim(p_name)
     and v_old_place is distinct from p_location and v_assigned is distinct from p_location then
    return jsonb_build_object('status', 'location_has_name');
  end if;
  -- 旧来の地図配置だけがある店舗も見落とさず、同じ店舗は一度だけ数える。
  with latest_assignments as (
    select distinct on (vendor_id) vendor_id, location_id
    from public.location_assignments
    order by vendor_id, market_date desc, created_at desc nulls last, id desc
  ), others as (
    select id from public.vendors where market_place_id = p_location and id <> p_vendor
    union
    select vendor_id from latest_assignments where location_id = p_location and vendor_id <> p_vendor
  ) select count(*) into v_other from others;
  if v_name is not null and v_name <> btrim(p_name) and not p_confirm then
    return jsonb_build_object('status', 'rename_confirmation_required', 'count', v_other, 'currentName', v_name);
  end if;
  if v_other > 0 and v_old_place is distinct from p_location and not p_confirm then
    return jsonb_build_object('status', 'confirmation_required', 'count', v_other);
  end if;
  if v_name is distinct from btrim(p_name) then
    begin
      update public.market_locations set place_name = btrim(p_name) where id = p_location;
    exception when unique_violation then
      return jsonb_build_object('status', 'name_in_use');
    end;
  end if;
  -- 既にその区画を地図で使っていた店舗も、位置が失われないよう同じ場所へ紐付ける。
  -- 他の店舗があるときは上の確認が必須。古い出店履歴だけの店舗は変更しない。
  with latest_assignments as (
    select distinct on (vendor_id) vendor_id, location_id from public.location_assignments
    order by vendor_id, market_date desc, created_at desc nulls last, id desc
  ), updated as (
    update public.vendors v set market_place_id = p_location
      from latest_assignments a
      where v.id = a.vendor_id and a.location_id = p_location and v.id <> p_vendor and v.market_place_id is null
      returning v.id
  ) select coalesce(array_agg(id), array[]::uuid[]) into v_promoted from updated;
  update public.vendors set market_place_id = p_location where id = p_vendor returning updated_at into v_updated_at;
  return jsonb_build_object('status', 'ok', 'updatedAt', v_updated_at, 'promoted', to_jsonb(v_promoted));
end;
$$;
revoke all on function public.set_vendor_market_place(uuid, uuid, text, boolean, timestamptz, text) from public, anon, authenticated;
grant execute on function public.set_vendor_market_place(uuid, uuid, text, boolean, timestamptz, text) to service_role;

-- 名前付き区画に紐づいた店舗は、個別の現場記録で別の位置や丁目を持てない。
-- 既存の記録は消さず、紐付け中は共通区画の値を表示する。
create function public.check_field_location_shared_place() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_place uuid; v_name text;
begin
  select market_place_id into v_place from public.vendors where id = new.vendor_id for share;
  if v_place is null then
    select location_id into v_place from public.location_assignments
      where vendor_id = new.vendor_id order by market_date desc, created_at desc nulls last, id desc limit 1;
    if v_place is not null then
      select place_name into v_name from public.market_locations where id = v_place for share;
      if v_name is null then v_place := null; end if;
    end if;
  end if;
  if v_place is not null then
    raise exception 'vendor_has_shared_market_place' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger check_field_location_shared_place
  before insert or update of store_number, latitude, longitude, chome_id on public.field_shop_locations
  for each row execute function public.check_field_location_shared_place();

-- 店舗メンバーによる直接更新では、管理者だけが行う場所の紐付けを変えられない。
create function public.prevent_vendor_market_place_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
     and new.market_place_id is distinct from old.market_place_id then
    raise exception '出店場所の登録は運営だけが変更できます' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger prevent_vendor_market_place_change before update of market_place_id
  on public.vendors for each row execute function public.prevent_vendor_market_place_change();

-- 場所名は管理者API経由のみ変更できる。名前を変えても区画IDは変わらない。
create function public.prevent_market_place_name_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
     and new.place_name is distinct from old.place_name then
    raise exception '出店場所名は運営だけが変更できます' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger prevent_market_place_name_change before update of place_name
  on public.market_locations for each row execute function public.prevent_market_place_name_change();

-- 名前付きの場所は直接削除しない。場所名と紐付けを整理してから削除する。
create function public.prevent_assigned_market_place_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.place_name is not null then
    raise exception 'market_place_has_vendors' using errcode = '23514';
  end if;
  return old;
end;
$$;
create trigger prevent_assigned_market_place_delete before delete
  on public.market_locations for each row execute function public.prevent_assigned_market_place_delete();
