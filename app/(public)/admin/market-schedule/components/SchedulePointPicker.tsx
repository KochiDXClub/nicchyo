"use client";

import { useMemo, useState } from "react";
import "../../../map-edit/v3/mapEditor.css";
import MapEditCanvasMapLibre from "../../../map-edit/v3/components/MapEditCanvasMapLibre";
import { useMapEditData } from "../../../map-edit/v3/useMapEditData";
import type { CanvasHandlers } from "../../../map-edit/v3/types";
import type { EntityChange } from "../../../map-edit/v3/editHistory";
import { resolveSlotPositions } from "@/lib/map/roadSlotPosition";

/**
 * 出店場所を地図の上で選ぶ（マップ編集ページと同じ地図の描画を使う）。
 *
 * 地図の描画は MapEditCanvasMapLibre をそのまま使い、区画の位置はマップ編集と同じ
 * `/api/admin/map-layout` から読む。この画面では読むだけなので、道・区画・建物の
 * 編集操作はすべて無効にし、区画を押したときだけ場所を選ぶ。
 */
const NO_CHANGES: EntityChange[] = [];
const NO_KEYS: ReadonlySet<string> = new Set<string>();
const NO_PREVIEW: never[] = [];
const NO_DRAFT: never[] = [];
const ZOOM_MAX = 2;
const noop = () => {};

export function SchedulePointPicker({ selected, onSelect }: { selected: string; onSelect: (locationId: string) => void }) {
  const layout = useMapEditData({ changes: NO_CHANGES });
  const [zoomIdx, setZoomIdx] = useState(1);
  const [focus, setFocus] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const shops = useMemo(() => resolveSlotPositions(layout.shops, layout.roads), [layout.shops, layout.roads]);

  const handlers: CanvasHandlers = {
    onSelectShop: onSelect,
    onDropVendor: noop,
    onSelectRoad: noop,
    onSelectLandmark: noop,
    onMoveLandmark: noop,
    onMoveLandmarkEnd: noop,
    onMapClick: noop,
    onMapDoubleClick: noop,
    onVertexMove: noop,
    onVertexMoveEnd: noop,
    onVertexRemove: noop,
    onMidpointInsert: noop,
  };

  return <div className="flex h-96 w-full overflow-hidden rounded-lg">
    <MapEditCanvasMapLibre
      tool="select"
      selection={selected ? { kind: "slot", id: selected } : null}
      unsavedKeys={NO_KEYS}
      shops={shops}
      roads={layout.roads}
      landmarks={layout.landmarks}
      draft={NO_DRAFT}
      previewSlots={NO_PREVIEW}
      search=""
      zoomIdx={zoomIdx}
      setZoomIdx={setZoomIdx}
      focus={focus}
      setFocus={setFocus}
      rotation={rotation}
      setRotation={setRotation}
      projection={layout.projection}
      handlers={handlers}
      isLoading={layout.isLoading}
      onZoomIn={() => setZoomIdx((prev) => Math.min(ZOOM_MAX, prev + 1))}
      onZoomOut={() => setZoomIdx((prev) => Math.max(0, prev - 1))}
    />
  </div>;
}
