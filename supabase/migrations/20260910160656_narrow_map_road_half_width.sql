-- 道の半幅を 15.6m から 11m に詰める。
--
-- market_locations 300 件を道の中心線に投影して実測したところ、店舗の中心線からの
-- 横距離は中央値 7.50m・最大 9.13m だった。半幅 15.6m では屋台の外側に片側 6.5m
-- （半幅の 42%）の空きが残り、道だけが不自然に広く見えていた。
-- いちばん外の屋台の外側に 2m 弱だけ残る 11m にする。
--
-- コード側の既定値（app/(public)/map/types/mapRoute.ts の DEFAULT_MAP_ROUTE_CONFIG）
-- も 11 に揃えてある。DB 値はコード既定を上書きするため、両方を合わせないと反映されない。

-- 新しく作られる行のための既定値
alter table map_route_configs
  alter column road_half_width_meters set default 11;

-- 既存行の更新。
-- 15.6 は 20260322120000_create_map_route_tables.sql が入れた初期値。
-- 運営が管理画面から意図的に別の値へ変えている場合まで上書きしないよう、
-- 初期値のままの行だけを対象にする（再実行しても二重に効かない）。
update map_route_configs
set
  road_half_width_meters = 11,
  updated_at = now()
where road_half_width_meters = 15.6;
