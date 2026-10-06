-- 区画（market_locations）の位置を「道基準」で持てるようにする。
--
-- これまで区画は緯度経度だけを持ち、どの道に乗っているかは保存のたびに
-- 最寄りの道への投影で導出していた。道の形を直しても区画はついてこないため、
-- 区画に「道のID・道の始点からの距離・左右どちら側か・道の中心線からの距離」を持たせる。
--
-- latitude / longitude は残す。公開マップ（shopDb.ts）と AI 検索（vendorSearch.ts）は
-- 引き続き緯度経度を読むため、道基準の位置を持つ区画はサーバーが保存のたびに
-- 道の形から緯度経度を計算し直して書き込む（app/api/admin/map-layout/route.ts）。
--
-- 既存の区画は4列とも NULL（道基準の位置なし）で始まり、管理画面の移行処理
-- （POST /api/admin/map-layout/slot-road-positions）で値を入れる。

alter table market_locations
  add column if not exists road_id text references map_roads(id) on delete restrict,
  add column if not exists road_distance_m double precision,
  add column if not exists road_side text,
  add column if not exists road_offset_m double precision;

-- 4列は「全部ある」か「全部ない」のどちらか。一部だけ入った区画は位置を決められないため
alter table market_locations
  drop constraint if exists market_locations_road_position_complete;
alter table market_locations
  add constraint market_locations_road_position_complete check (
    (road_id is null and road_distance_m is null and road_side is null and road_offset_m is null)
    or (
      road_id is not null
      and road_distance_m is not null and road_distance_m >= 0
      and road_side in ('left', 'right')
      and road_offset_m is not null and road_offset_m >= 0 and road_offset_m <= 100
    )
  );

create index if not exists market_locations_road_id_idx on market_locations (road_id);


-- ─── save_map_layout ────────────────────────────────────────────────────
-- PUT /api/admin/map-layout の書き込みを1つのトランザクションにまとめる。
-- これまでは区画・割り当て・建物を別々の問い合わせで順に書き込み、道と道の点だけを
-- save_roads_and_points で1トランザクションにしていたため、途中で失敗すると
-- 一部だけ書き込まれた状態が残っていた。
--
-- また、区画が道を外部キーで参照するようになったため、書き込みの順序が重要になる:
--   道の追加・更新 → 道の点 → 出店者の追加・更新 → 区画の削除 → 区画の更新・追加
--   → 割り当て → 建物 → 取り除かれた道の削除（区画がまだ乗っていれば外部キーで失敗し、全体が戻る）
--
-- 出店者（p_vendors）は、マップ編集画面の空き区画から新しく登録した出店者（id が
-- "new-vendor-..." の仮 id）と、画面で情報を直した既存の出店者。新しい出店者は
-- 20261004150000 でアカウントなしでも作れるようにしている。区画の vendorId に仮 id が
-- 入っていれば、採番された id に置き換えて割り当てる。
--
-- 検証（権限・上限・区画が乗っている道の削除禁止など）とスナップショットの作成は
-- 呼び出し側（route.ts）が行う。この関数は検証済みの内容を書き込むだけ。
--
-- 条件なしの DELETE は使わない（Supabase は PostgREST 経由の接続に safeupdate を
-- 読み込ませることがあり、WHERE の無い DELETE がエラーになるため）。
create or replace function save_map_layout(
  p_save_roads             boolean,
  p_roads                  jsonb,
  p_points                 jsonb,
  p_removed_road_ids       jsonb,
  p_shops                  jsonb,
  p_shop_positions         jsonb,
  p_deleted_location_ids   jsonb,
  p_landmarks              jsonb,
  p_deleted_landmark_keys  jsonb,
  p_route_config           jsonb,
  p_vendors                jsonb default '[]'::jsonb
)
-- 新しく登録した出店者の「仮 id → 採番された id」を返す（呼び出し側が監査ログに残すため）
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_created jsonb := '{}'::jsonb;
  v_created_vendors jsonb := '{}'::jsonb;
  v_elem jsonb;
  v_id uuid;
begin
  -- ① 道（map_roads）の追加・更新と、道の点（map_route_points）の全置換
  if p_save_roads then
    if p_roads is not null and jsonb_array_length(p_roads) > 0 then
      insert into map_roads (id, name, kind, width_meters)
      select elem->>'id', elem->>'name', elem->>'kind', (elem->>'widthMeters')::double precision
      from jsonb_array_elements(p_roads) as elem
      on conflict (id) do update set
        name         = excluded.name,
        kind         = excluded.kind,
        width_meters = excluded.width_meters,
        updated_at   = now();
    end if;

    delete from map_route_points where true;

    if p_points is not null and jsonb_array_length(p_points) > 0 then
      -- branch_from_id は自己参照の外部キーのため、先に id だけ入れてから UPDATE する
      insert into map_route_points (id, latitude, longitude, sort_order, road_id)
      select
        elem->>'id',
        (elem->>'latitude')::double precision,
        (elem->>'longitude')::double precision,
        (elem->>'sort_order')::integer,
        elem->>'road_id'
      from jsonb_array_elements(p_points) as elem;

      update map_route_points rp
      set branch_from_id = elem->>'branch_from_id'
      from jsonb_array_elements(p_points) as elem
      where rp.id = elem->>'id'
        and (elem->>'branch_from_id') is not null
        and (elem->>'branch_from_id') <> '';
    end if;
  end if;

  -- ①' 出店者の追加・更新（区画の割り当てより先に。新しい出店者の仮 id → 採番された id を覚える）
  for v_elem in select value from jsonb_array_elements(coalesce(p_vendors, '[]'::jsonb))
  loop
    if v_elem->>'id' like 'new-vendor-%' then
      insert into vendors (shop_name, category_id, strength, main_products)
      values (
        v_elem->>'name',
        nullif(v_elem->>'categoryId', '')::uuid,
        nullif(v_elem->>'strength', ''),
        array(select jsonb_array_elements_text(coalesce(v_elem->'mainProducts', '[]'::jsonb)))
      )
      returning id into v_id;
      v_created_vendors := v_created_vendors || jsonb_build_object(v_elem->>'id', v_id);
    else
      update vendors
      set
        shop_name     = v_elem->>'name',
        category_id   = nullif(v_elem->>'categoryId', '')::uuid,
        strength      = nullif(v_elem->>'strength', ''),
        main_products = array(select jsonb_array_elements_text(coalesce(v_elem->'mainProducts', '[]'::jsonb))),
        updated_at    = now()
      where id = (v_elem->>'id')::uuid;
      if not found then
        raise exception 'vendor not found: %', v_elem->>'id';
      end if;
    end if;
  end loop;

  -- ② 区画の削除（先に消す。消した区画の店番を、同じ保存で追加する区画が使えるように）
  if p_deleted_location_ids is not null and jsonb_array_length(p_deleted_location_ids) > 0 then
    delete from market_locations
    where id in (select (jsonb_array_elements_text(p_deleted_location_ids))::uuid);
  end if;

  -- ③ 既存の区画の更新（丁目は送られてきたときだけ上書きする）
  update market_locations ml
  set
    store_number    = (elem->>'position')::integer,
    latitude        = (elem->>'lat')::double precision,
    longitude       = (elem->>'lng')::double precision,
    district        = coalesce(elem->>'chome', ml.district),
    road_id         = elem->>'roadId',
    road_distance_m = (elem->>'roadDistanceM')::double precision,
    road_side       = elem->>'roadSide',
    road_offset_m   = (elem->>'roadOffsetM')::double precision
  from jsonb_array_elements(coalesce(p_shops, '[]'::jsonb)) as elem
  where (elem->>'locationId') not like 'new-%'
    and ml.id = (elem->>'locationId')::uuid;

  -- ③' 道の形が変わったために位置だけ計算し直した区画（割り当ては触らない）
  update market_locations ml
  set
    latitude  = (elem->>'lat')::double precision,
    longitude = (elem->>'lng')::double precision
  from jsonb_array_elements(coalesce(p_shop_positions, '[]'::jsonb)) as elem
  where ml.id = (elem->>'locationId')::uuid;

  -- ④ 新しい区画の追加（画面上の仮 id "new-..." → 採番された id の対応を覚えておく）
  for v_elem in
    select value from jsonb_array_elements(coalesce(p_shops, '[]'::jsonb))
    where value->>'locationId' like 'new-%'
  loop
    insert into market_locations (
      store_number, latitude, longitude, district, road_id, road_distance_m, road_side, road_offset_m
    )
    values (
      (v_elem->>'position')::integer,
      (v_elem->>'lat')::double precision,
      (v_elem->>'lng')::double precision,
      v_elem->>'chome',
      v_elem->>'roadId',
      (v_elem->>'roadDistanceM')::double precision,
      v_elem->>'roadSide',
      (v_elem->>'roadOffsetM')::double precision
    )
    returning id into v_id;
    v_created := v_created || jsonb_build_object(v_elem->>'locationId', v_id);
  end loop;

  -- ⑤ 出店者の割り当て。送られてきた区画と出店者の古い割り当てを外してから入れ直す
  -- （同じ出店者を2つの区画に置かない・1つの区画に2つの出店者を置かないため）
  with targets as (
    select
      coalesce((v_created->>(elem->>'locationId'))::uuid, nullif(elem->>'locationId', '')::uuid) as location_id,
      coalesce((v_created_vendors->>(elem->>'vendorId'))::uuid, nullif(elem->>'vendorId', '')::uuid) as vendor_id
    from jsonb_array_elements(coalesce(p_shops, '[]'::jsonb)) as elem
    where (elem->>'locationId') not like 'new-%' or v_created ? (elem->>'locationId')
  )
  delete from location_assignments la
  where la.location_id in (select location_id from targets)
     or la.vendor_id in (select vendor_id from targets where vendor_id is not null);

  insert into location_assignments (location_id, vendor_id, market_date)
  select
    coalesce((v_created->>(elem->>'locationId'))::uuid, (elem->>'locationId')::uuid),
    coalesce((v_created_vendors->>(elem->>'vendorId'))::uuid, (elem->>'vendorId')::uuid),
    v_today
  from jsonb_array_elements(coalesce(p_shops, '[]'::jsonb)) as elem
  where nullif(elem->>'vendorId', '') is not null;

  -- ⑥ 建物
  if p_deleted_landmark_keys is not null and jsonb_array_length(p_deleted_landmark_keys) > 0 then
    delete from map_landmarks where key in (select jsonb_array_elements_text(p_deleted_landmark_keys));
  end if;

  if p_landmarks is not null and jsonb_array_length(p_landmarks) > 0 then
    insert into map_landmarks (key, name, description, image_url, latitude, longitude, width_px, height_px, show_at_min_zoom)
    select
      elem->>'key',
      elem->>'name',
      elem->>'description',
      elem->>'url',
      (elem->>'lat')::double precision,
      (elem->>'lng')::double precision,
      (elem->>'widthPx')::double precision,
      (elem->>'heightPx')::double precision,
      (elem->>'showAtMinZoom')::boolean
    from jsonb_array_elements(p_landmarks) as elem
    on conflict (key) do update set
      name             = excluded.name,
      description      = excluded.description,
      image_url        = excluded.image_url,
      latitude         = excluded.latitude,
      longitude        = excluded.longitude,
      width_px         = excluded.width_px,
      height_px        = excluded.height_px,
      show_at_min_zoom = excluded.show_at_min_zoom;
  end if;

  -- ⑦ 取り除かれた道の削除（区画の更新の後。区画がまだ乗っていれば外部キーで失敗する）
  if p_save_roads and p_removed_road_ids is not null and jsonb_array_length(p_removed_road_ids) > 0 then
    delete from map_roads where id in (select jsonb_array_elements_text(p_removed_road_ids));
  end if;

  -- ⑧ ルートの設定
  if p_route_config is not null and p_route_config <> 'null'::jsonb then
    insert into map_route_configs (key, road_half_width_meters, snap_distance_meters, visible_distance_meters)
    values (
      p_route_config->>'key',
      (p_route_config->>'roadHalfWidthMeters')::double precision,
      (p_route_config->>'snapDistanceMeters')::double precision,
      (p_route_config->>'visibleDistanceMeters')::double precision
    )
    on conflict (key) do update set
      road_half_width_meters  = excluded.road_half_width_meters,
      snap_distance_meters    = excluded.snap_distance_meters,
      visible_distance_meters = excluded.visible_distance_meters,
      updated_at              = now();
  end if;

  return jsonb_build_object('createdVendors', v_created_vendors);
end;
$$;


-- ─── set_market_location_road_positions ────────────────────────────────
-- 既存の区画に道基準の位置を入れる移行処理（POST /api/admin/map-layout/slot-road-positions）。
-- まだ道基準の位置を持たない区画だけを更新する（移行済みの区画を上書きしないため）。
-- 緯度経度は変えない（公開マップの見た目を移行で変えないため）。
create or replace function set_market_location_road_positions(p_positions jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update market_locations ml
  set
    road_id         = elem->>'roadId',
    road_distance_m = (elem->>'roadDistanceM')::double precision,
    road_side       = elem->>'roadSide',
    road_offset_m   = (elem->>'roadOffsetM')::double precision
  from jsonb_array_elements(coalesce(p_positions, '[]'::jsonb)) as elem
  where ml.id = (elem->>'locationId')::uuid
    and ml.road_id is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ─── restore_map_layout_snapshot（道基準の位置に対応） ─────────────────────
-- 20260810031500 の版からの変更点:
--   - 区画が道を外部キーで参照するため、道の追加・更新を区画より先に行い、
--     道の削除を区画の更新より後に行う
--   - スナップショットにない区画を先に消してから upsert する（消える区画と
--     復元する区画の店番が重なっても一意制約に引っかからないように）
--   - 区画の道基準の位置も復元する。位置を持たない古いスナップショットや、
--     参照先の道が無い区画は、道基準の位置なし（緯度経度だけ）で戻す
--   - 条件なしの DELETE を使わない
--   - 建物の幅・高さ（map_landmarks.width_px / height_px は double precision）を整数に
--     変換しない。以前の版は ::integer で変換しており、幅に小数を持つ建物（127.68 など）が
--     あるとスナップショットの復元が失敗していた
create or replace function restore_map_layout_snapshot(
  p_shops        jsonb,
  p_landmarks    jsonb,
  p_route_points jsonb,
  p_route_config jsonb,
  p_roads        jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  -- ① 道の追加・更新（区画が参照するため先に行う）
  if p_roads is not null and jsonb_array_length(p_roads) > 0 then
    insert into map_roads (id, name, kind, width_meters)
    select elem->>'id', elem->>'name', elem->>'kind', (elem->>'widthMeters')::double precision
    from jsonb_array_elements(p_roads) as elem
    on conflict (id) do update set
      name         = excluded.name,
      kind         = excluded.kind,
      width_meters = excluded.width_meters,
      updated_at   = now();
  end if;

  -- ② 道の点の全置換（branch_from_id は自己参照の外部キーのため、先に id だけ入れる）
  delete from map_route_points where true;

  if p_route_points is not null and jsonb_array_length(p_route_points) > 0 then
    insert into map_route_points (id, latitude, longitude, sort_order, road_id)
    select
      elem->>'id',
      (elem->>'lat')::double precision,
      (elem->>'lng')::double precision,
      (elem->>'order')::integer,
      elem->>'roadId'
    from jsonb_array_elements(p_route_points) as elem;

    update map_route_points rp
    set branch_from_id = elem->>'branchFromId'
    from jsonb_array_elements(p_route_points) as elem
    where rp.id = elem->>'id'
      and (elem->>'branchFromId') is not null
      and (elem->>'branchFromId') <> '';
  end if;

  -- ③ スナップショットにない区画を消す（割り当ては外部キーの cascade で一緒に消える）
  if p_shops is not null and jsonb_array_length(p_shops) > 0 then
    delete from market_locations
    where id not in (select (elem->>'locationId')::uuid from jsonb_array_elements(p_shops) as elem);
  else
    delete from market_locations where true;
  end if;

  -- ④ 区画の upsert。district（丁目）は古いスナップショットに無いことがあるため、
  -- NULL のときは現在値を残す。道基準の位置は、参照先の道があるときだけ戻す
  if p_shops is not null and jsonb_array_length(p_shops) > 0 then
    insert into market_locations (
      id, store_number, latitude, longitude, district, road_id, road_distance_m, road_side, road_offset_m
    )
    select
      (elem->>'locationId')::uuid,
      (elem->>'position')::integer,
      (elem->>'lat')::double precision,
      (elem->>'lng')::double precision,
      elem->>'chome',
      case when has_road then elem->>'roadId' end,
      case when has_road then (elem->>'roadDistanceM')::double precision end,
      case when has_road then elem->>'roadSide' end,
      case when has_road then (elem->>'roadOffsetM')::double precision end
    from (
      select
        elem,
        (
          elem->>'roadId' is not null
          and elem->>'roadDistanceM' is not null
          and elem->>'roadSide' in ('left', 'right')
          and elem->>'roadOffsetM' is not null
          and exists (select 1 from map_roads r where r.id = elem->>'roadId')
        ) as has_road
      from jsonb_array_elements(p_shops) as elem
    ) as s
    on conflict (id) do update set
      store_number    = excluded.store_number,
      latitude        = excluded.latitude,
      longitude       = excluded.longitude,
      district        = coalesce(excluded.district, market_locations.district),
      road_id         = excluded.road_id,
      road_distance_m = excluded.road_distance_m,
      road_side       = excluded.road_side,
      road_offset_m   = excluded.road_offset_m;
  end if;

  -- ⑤ 割り当てを入れ直す
  delete from location_assignments where true;

  if p_shops is not null and jsonb_array_length(p_shops) > 0 then
    insert into location_assignments (location_id, vendor_id, market_date)
    select (elem->>'locationId')::uuid, (elem->>'vendorId')::uuid, v_today
    from jsonb_array_elements(p_shops) as elem
    where nullif(elem->>'vendorId', '') is not null;
  end if;

  -- ⑥ 建物
  if p_landmarks is not null and jsonb_array_length(p_landmarks) > 0 then
    insert into map_landmarks (key, name, description, image_url, latitude, longitude, width_px, height_px, show_at_min_zoom)
    select
      elem->>'key',
      elem->>'name',
      elem->>'description',
      elem->>'url',
      (elem->>'lat')::double precision,
      (elem->>'lng')::double precision,
      (elem->>'widthPx')::double precision,
      (elem->>'heightPx')::double precision,
      (elem->>'showAtMinZoom')::boolean
    from jsonb_array_elements(p_landmarks) as elem
    on conflict (key) do update set
      name             = excluded.name,
      description      = excluded.description,
      image_url        = excluded.image_url,
      latitude         = excluded.latitude,
      longitude        = excluded.longitude,
      width_px         = excluded.width_px,
      height_px        = excluded.height_px,
      show_at_min_zoom = excluded.show_at_min_zoom;

    delete from map_landmarks
    where key not in (select elem->>'key' from jsonb_array_elements(p_landmarks) as elem);
  else
    delete from map_landmarks where true;
  end if;

  -- ⑦ スナップショットにない道を消す（区画の更新の後）。
  -- p_roads が NULL のときは「道に未対応の古いスナップショット」なので道を変えない。
  -- 空配列は「保存時点で道が0件だった」という明示的な状態として全部消す
  if p_roads is not null then
    delete from map_roads
    where id not in (select elem->>'id' from jsonb_array_elements(p_roads) as elem);
  end if;

  -- ⑧ ルートの設定
  if p_route_config is not null and p_route_config <> 'null'::jsonb then
    insert into map_route_configs (key, road_half_width_meters, snap_distance_meters, visible_distance_meters)
    values (
      p_route_config->>'key',
      (p_route_config->>'roadHalfWidthMeters')::double precision,
      (p_route_config->>'snapDistanceMeters')::double precision,
      (p_route_config->>'visibleDistanceMeters')::double precision
    )
    on conflict (key) do update set
      road_half_width_meters  = excluded.road_half_width_meters,
      snap_distance_meters    = excluded.snap_distance_meters,
      visible_distance_meters = excluded.visible_distance_meters,
      updated_at              = now();
  end if;
end;
$$;


-- ─── 実行権限 ────────────────────────────────────────────────────────────
-- いずれも SECURITY DEFINER で破壊的な操作を行うため、service_role 専用にする
-- （20260906123419 と同じ方針。PUBLIC 分も外さないと anon から実行できてしまう）
revoke execute on function save_map_layout(boolean, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function save_map_layout(boolean, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

revoke execute on function set_market_location_road_positions(jsonb) from public, anon, authenticated;
grant execute on function set_market_location_road_positions(jsonb) to service_role;

revoke execute on function restore_map_layout_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function restore_map_layout_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
