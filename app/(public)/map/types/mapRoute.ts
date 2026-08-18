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
  roadHalfWidthMeters: 15.6,
  snapDistanceMeters: 18,
  visibleDistanceMeters: 42,
};
