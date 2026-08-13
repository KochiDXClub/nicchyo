import type { EditableShop } from "../../map/types/editableShop";
import type { Landmark as EditableLandmark } from "../../map/types/landmark";
import type { MapRoad, MapRoutePoint, RoadKind } from "../../map/types/mapRoute";

export const CHOME_ORDER = ["一丁目", "二丁目", "三丁目", "四丁目", "五丁目", "六丁目", "七丁目"];

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
// 道の頂点編集（ドラッグ移動・ダブルクリック削除・中点クリックで追加）は
// 道を選択しさえすれば常に有効（旧エディタのように、選択したらすぐ触れる）。
// "draw" は新しい道を新規作成しているときだけの状態。
export type RoadAction = "idle" | "draw";
export type LandmarkAction = "idle" | "place";

export type PendingChangeSnapshot = {
  shops: EditableShop[];
  roads: EditableRoad[];
  landmarks: EditableLandmark[];
};

export type PendingChange = {
  id: number;
  label: string;
  text: string;
  /**
   * この変更を適用する直前の状態。「直前を取り消す」でここへ復元する。
   * 実データを変更しない通知（例: 削除を拒否した旨のメッセージ）の場合は undefined にでき、
   * その場合 undo はログ表示を消すだけで状態は変更しない。
   */
  before?: PendingChangeSnapshot;
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
