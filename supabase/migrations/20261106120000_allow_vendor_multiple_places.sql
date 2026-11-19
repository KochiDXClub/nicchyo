-- 場所の登録は market_place_memberships で管理する。
-- 旧来の単一 market_place_id に基づいて別の場所を拒否しない。
drop trigger if exists check_vendor_place_assignment on public.location_assignments;
drop trigger if exists check_field_location_shared_place on public.field_shop_locations;
