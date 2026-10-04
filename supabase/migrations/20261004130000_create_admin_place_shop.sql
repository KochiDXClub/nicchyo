-- 運営が現地で、店舗を店番に置き、その座標を決める。1 つのトランザクションで行う。
--
-- API で「区画の作成/更新 → 店舗の以前の割り当てを削除 → 区画の以前の割り当てを削除 → 割り当てを追加」を
-- 別々に呼ぶと、途中で失敗したときに店番の割り当てが消えたまま残り、2 台で同じ店番を同時に置くと
-- 二重に割り当てられる。ここにまとめ、区画の行をロックして順番に処理する。
--
-- 戻り値:
--   {"status": "placed"}                                … 置いた
--   {"status": "taken", "occupant_vendor_id": "<uuid>"} … 別の店舗が使っていて、p_force が false（何も変えていない）
--
-- service_role 専用。呼び出し元（/api/admin/shops/[id]/location）が管理者の認可と、保存前のスナップショットを担う。

create or replace function public.admin_place_shop(
  p_vendor_id uuid,
  p_store_number integer,
  p_lat double precision,
  p_lng double precision,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location_id uuid;
  v_occupant uuid;
begin
  -- 区画がなければ作る（同時に作ろうとしても、store_number の UNIQUE で 1 つになる）
  insert into public.market_locations (store_number, latitude, longitude)
  values (p_store_number, p_lat, p_lng)
  on conflict (store_number) do nothing;

  -- 区画の行をロックして、以降の判断と書き込みの間に別のリクエストが割り込めないようにする
  select id into v_location_id
  from public.market_locations
  where store_number = p_store_number
  for update;

  select vendor_id into v_occupant
  from public.location_assignments
  where location_id = v_location_id
    and vendor_id <> p_vendor_id
  limit 1;

  if v_occupant is not null and not p_force then
    return jsonb_build_object('status', 'taken', 'occupant_vendor_id', v_occupant);
  end if;

  update public.market_locations
  set latitude = p_lat, longitude = p_lng
  where id = v_location_id;

  -- この店舗の以前の店番と、この店番の以前の持ち主（p_force のとき）を外してから置く
  delete from public.location_assignments where vendor_id = p_vendor_id;
  delete from public.location_assignments where location_id = v_location_id;

  insert into public.location_assignments (location_id, vendor_id, market_date)
  values (v_location_id, p_vendor_id, current_date);

  return jsonb_build_object('status', 'placed');
end;
$$;

revoke all on function public.admin_place_shop(uuid, integer, double precision, double precision, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_place_shop(uuid, integer, double precision, double precision, boolean)
  to service_role;

comment on function public.admin_place_shop(uuid, integer, double precision, double precision, boolean) is
  '運営が店舗を店番に置き、座標を決める（トランザクション）。service_role 専用。';
