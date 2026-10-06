import { CHOME_ORDER } from "../../map/types/editableShop";
import type { EditableShop } from "../../map/types/editableShop";
import type { Landmark as EditableLandmark } from "../../map/types/landmark";
import type { MapRoad, MapRoutePoint, RoadKind } from "../../map/types/mapRoute";

export { CHOME_ORDER };

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

/**
 * 地図左上の道具パレットで選ぶ道具。
 * 選択以外の道具は、1回の操作を終えるか Esc を押すと選択に戻る。
 */
export type Tool = "select" | "drawRoad" | "splitSlots" | "placeLandmark";

/** 選択ツールで選んでいるもの。道・区画・建物のどれか1つ */
export type Selection =
  | { kind: "road"; id: string }
  | { kind: "slot"; id: string }
  | { kind: "landmark"; id: string };

/** キャンバス（MapEditCanvasMapLibre）から親（MapEditClientV3）へ通知する操作 */
export type CanvasHandlers = {
  onSelectShop: (locationId: string) => void;
  onSelectRoad: (roadId: string) => void;
  onSelectLandmark: (key: string) => void;
  /** ドラッグ中の位置（記録しない） */
  onMoveLandmark: (key: string, lat: number, lng: number) => void;
  /** ドラッグを終えた位置（ここで1件の操作として記録する） */
  onMoveLandmarkEnd: (key: string, lat: number, lng: number) => void;
  onMapClick: (lat: number, lng: number) => void;
  onVertexMove: (roadId: string, pointId: string, lat: number, lng: number) => void;
  onVertexMoveEnd: (roadId: string, pointId: string, lat: number, lng: number) => void;
  onVertexRemove: (roadId: string, pointId: string) => void;
  onMidpointInsert: (roadId: string, afterIndex: number, lat: number, lng: number) => void;
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

export type { EditableLandmark, EditableShop, MapRoad, MapRoutePoint, RoadKind };
