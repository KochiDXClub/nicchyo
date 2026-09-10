export type MapRoutePoint = {
  id: string;
  lat: number;
  lng: number;
  order: number;
  branchFromId?: string | null;
  roadId?: string | null;
};

export type RoadKind = "market" | "street" | "path";

export type MapRoad = {
  id: string;
  name: string;
  kind: RoadKind;
  widthMeters: number;
};

export type MapRouteConfig = {
  key: string;
  roadHalfWidthMeters: number;
  snapDistanceMeters: number;
  visibleDistanceMeters: number;
};

export type MapRoute = {
  points: MapRoutePoint[];
  config: MapRouteConfig;
};

export const DEFAULT_MAP_ROUTE_CONFIG: MapRouteConfig = {
  key: "default",
  /**
   * 道の半幅（中心線から縁まで）。
   *
   * 実測（market_locations 300件）では、店舗の中心線からの横距離は
   * 中央値 7.50m・最大 9.13m。半幅 15.6m では外側に片側 6.5m の空きが残り、
   * 屋台の外に何もない帯が広く見えていた。
   * いちばん外の屋台の外側に 2m 弱だけ残る幅にする。
   */
  roadHalfWidthMeters: 11,
  snapDistanceMeters: 18,
  visibleDistanceMeters: 42,
};
