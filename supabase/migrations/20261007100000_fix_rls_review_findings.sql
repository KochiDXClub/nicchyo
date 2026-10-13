-- RLS / DB レビュー指摘の前方修正（適用済みマイグレーションは編集せず、ここで直す）。
-- すべて冪等（drop ... if exists / create or replace / revoke）。
--
-- 1. vendor_contents の公開 SELECT を 31 日窓に戻す
--    20261004120000 の alter policy が expires_at > now() に戻してしまい、
--    期限切れの近況（褪せていくタイムライン。20260713000001）が anon から読めなくなっていた。
--    掲載許可のフィルタ（vendors で読める店舗だけ）は維持する。
-- 2. product_sales の "authenticated can read product_sales" using (true) を落とす
--    OR 結合で掲載許可のフィルタ（"public can read listed product_sales"）が無効化されていた。
--    アプリに product_sales を authenticated で直接読む箇所は無い（grep 済み。書き込みは
--    "vendors can manage own product_sales" が店舗メンバーに許す）。
-- 3. vendor_weekly_status の公開 SELECT を、vendors で読める店舗の行だけにする
-- 4. admin_place_shop が道基準の位置（road_*）を残すと、次回のマップ保存で座標が上書きされる
--    ので、現地で置いたときは road_* を NULL に戻す（complete-or-null CHECK を満たす）
-- 5. reports / inquiries は anon・authenticated からの直接 INSERT を閉じる
--    書き込みは app/api/reports・app/api/contact が service_role（RLS を通らない）で行っており、
--    直接 INSERT を許すと API の入力検証・レート制限を迂回して status や返信欄まで書ける
-- 6. track_home_visit は /api/analytics/home-visit が service_role で呼ぶだけなので、
--    anon / authenticated からの実行を閉じる（来訪者統計の汚染防止）
--    product_search_logs（ブラウザから直接 INSERT）と web_page_analytics（cookie クライアントで INSERT）
--    は書き込み経路をサーバー側へ移す変更が要るため、ここでは触らない。

-- ── 1. vendor_contents ──────────────────────────────────────────────
drop policy if exists "public can read active contents" on public.vendor_contents;
create policy "public can read active contents"
  on public.vendor_contents for select
  using (
    created_at > now() - interval '31 days'
    and status = 'active'
    and vendor_id in (select id from public.vendors)
  );

-- ── 2. product_sales ────────────────────────────────────────────────
drop policy if exists "authenticated can read product_sales" on public.product_sales;

-- ── 3. vendor_weekly_status ─────────────────────────────────────────
drop policy if exists "public can read vendor weekly status" on public.vendor_weekly_status;
create policy "public can read vendor weekly status"
  on public.vendor_weekly_status for select
  using (vendor_id in (select id from public.vendors));

-- ── 4. admin_place_shop ─────────────────────────────────────────────
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
  insert into public.market_locations (store_number, latitude, longitude)
  values (p_store_number, p_lat, p_lng)
  on conflict (store_number) do nothing;

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

  -- 現地で座標を決めたので、道基準の位置は消す（残すと次のマップ保存で座標が道基準から再計算され、
  -- 置いた位置が元に戻る）。4 列は complete-or-null CHECK により、すべて NULL か すべて入力のどちらか
  update public.market_locations
  set latitude = p_lat,
      longitude = p_lng,
      road_id = null,
      road_distance_m = null,
      road_side = null,
      road_offset_m = null
  where id = v_location_id;

  delete from public.location_assignments where vendor_id = p_vendor_id;
  delete from public.location_assignments where location_id = v_location_id;

  insert into public.location_assignments (location_id, vendor_id, market_date)
  values (v_location_id, p_vendor_id, (now() at time zone 'Asia/Tokyo')::date);

  return jsonb_build_object('status', 'placed');
end;
$$;

revoke all on function public.admin_place_shop(uuid, integer, double precision, double precision, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_place_shop(uuid, integer, double precision, double precision, boolean)
  to service_role;

-- ── 5. reports / inquiries ──────────────────────────────────────────
drop policy if exists "reports_insert_anyone" on public.reports;
drop policy if exists "inquiries_insert_anyone" on public.inquiries;
revoke insert on public.reports from anon, authenticated;
revoke insert on public.inquiries from anon, authenticated;

-- ── 6. track_home_visit ─────────────────────────────────────────────
revoke all on function public.track_home_visit(date, text) from public, anon, authenticated;
grant execute on function public.track_home_visit(date, text) to service_role;
