import type { Landmark as EditableLandmark } from "../../map/types/landmark";
import type { MapRoad, MapRoutePoint, RoadKind } from "../../map/types/mapRoute";

export type EditableShop = {
  locationId: string;
  id: number;
  vendorId?: string;
  name: string;
  lat: number;
  lng: number;
  position: number;
};

export type VendorOption = {
  id: string;
  name: string;
};

export type EditableRoad = MapRoad & {
  points: MapRoutePoint[];
};

export type SnapshotItem = {
  id: string;
  created_at: string;
  created_by: string | null;
  summary?: {
    updatedShopCount?: number;
    deletedShopCount?: number;
    upsertLandmarkCount?: number;
    deletedLandmarkCount?: number;
    updatedRoadCount?: number;
    deletedRoadCount?: number;
    restoreSourceSnapshotId?: string;
  } | null;
};

export type Tab = "slot" | "road" | "landmark";

export type SlotAction = "idle" | "move" | "place";
export type RoadAction = "idle" | "draw" | "shape";
export type LandmarkAction = "idle" | "place";

export type PendingChange = {
  id: number;
  label: string;
  text: string;
};

export const ROAD_KIND_LABELS: Record<RoadKind, string> = {
  market: "出店可の通り",
  street: "一般道",
  path: "歩道・小路",
};

export const ROAD_KIND_DEFAULT_WIDTH: Record<RoadKind, number> = {
  market: 36,
  street: 26,
  path: 14,
};

export type { EditableLandmark, MapRoad, MapRoutePoint, RoadKind };
