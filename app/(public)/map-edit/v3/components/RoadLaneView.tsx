"use client";

import { useEffect, useRef, useState } from "react";
import { projectOntoRoad } from "@/lib/map/roadSlotPosition";
import { EDITOR_COLORS } from "../editorTheme";
import { CHOME_WEST_TO_EAST, type EditableRoad, type EditableShop } from "../types";
import { slotLabel } from "../../../map/types/editableShop";

export type Side = "north" | "south";

export type LaneShop = { shop: EditableShop; side: Side; order: number };

export type LaneSection = {
  chome: string;
  north: LaneShop[];
  south: LaneShop[];
  columns: number;
};

export type LaneRoadGroup = {
  road: EditableRoad;
  sections: LaneSection[];
};

/**
 * 区画が道のどちら側（レーンの上の列 north / 下の列 south）の、どの位置（道の始点からの距離 m）にあるか。
 * 上の列は道の進行方向（始点 → 終点）に向かって左側。道基準の位置を持つ区画はその値をそのまま使い、
 * 持たない区画（移行前）は道への投影で求める。
 */
export function sideOfShop(shop: EditableShop, road: EditableRoad): { side: Side; order: number } {
  if (shop.roadId === road.id && shop.roadSide && shop.roadDistanceM != null) {
    return { side: shop.roadSide === "left" ? "north" : "south", order: shop.roadDistanceM };
  }
  const projection = projectOntoRoad(road.points, shop);
  if (!projection) return { side: "north", order: 0 };
  return { side: projection.side === "left" ? "north" : "south", order: projection.distanceM };
}

/**
 * 区画レーンの表示順（道→丁目→北側/南側を対にしたカラム）を組み立てる。
 * レーン表示（RoadLaneView）と、キーボード/WASDでの区画間ナビゲーション
 * （MapEditClientV3）の両方が同じ並び順を参照できるよう、ここに1本化する。
 */
export function buildLaneRoadGroups(
  shops: EditableShop[],
  roads: EditableRoad[],
  roadIdOf: (shop: EditableShop) => string | null
): LaneRoadGroup[] {
  const marketRoads = roads.filter((r) => r.kind === "market" && r.points.length >= 2);

  return marketRoads
    .map((road) => {
      const shopsOnRoad = shops.filter((s) => roadIdOf(s) === road.id);
      const byChome = new Map<string, EditableShop[]>();
      for (const shop of shopsOnRoad) {
        const key = shop.chome ?? "その他";
        const list = byChome.get(key) ?? [];
        list.push(shop);
        byChome.set(key, list);
      }

      const orderedChomeKeys = [...CHOME_WEST_TO_EAST, "その他"].filter((key) => byChome.has(key));
      const sections: LaneSection[] = orderedChomeKeys.map((chome) => {
        const withSide = byChome.get(chome)!.map((shop) => ({ shop, ...sideOfShop(shop, road) }));
        const north = withSide.filter((m) => m.side === "north").sort((a, b) => a.order - b.order);
        const south = withSide.filter((m) => m.side === "south").sort((a, b) => a.order - b.order);
        return { chome, north, south, columns: Math.max(north.length, south.length) };
      });

      return { road, sections };
    })
    .filter((group) => group.sections.length > 0);
}

export default function RoadLaneView({
  groups,
  selectedLocationId,
  search,
  onSelectShop,
  onDropVendor,
}: {
  groups: LaneRoadGroup[];
  selectedLocationId: string | null;
  search: string;
  onSelectShop: (locationId: string) => void;
  /** 出店者のいるセルを別のセルへドラッグしたとき（移動先に出店者がいれば入れ替え） */
  onDropVendor: (fromLocationId: string, toLocationId: string) => void;
}) {
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [dragFromId, setDragFromId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const q = search.trim().toLowerCase();

  useEffect(() => {
    if (!selectedLocationId) return;
    const el = cellRefs.current.get(selectedLocationId);
    // smoothだと連続でキー移動した際にアニメーションが追いつかず、選択中のセルが
    // 見切れたまま次の移動が来てしまう（止まったタイミングでようやく追いつく）ため、
    // 即座に追従するinstantに変更する
    el?.scrollIntoView({ behavior: "instant", inline: "center", block: "nearest" });
  }, [selectedLocationId]);

  if (groups.length === 0) return null;

  // 空きセル（向かい側だけに区画がある列）にも key を付ける。付けないと React の
  // 「Each child in a list should have a unique key」警告が出る
  const renderCell = (item: LaneShop | undefined, emptyKey: string) => {
    if (!item) {
      return <div key={emptyKey} style={{ width: 64, height: 44, flexShrink: 0 }} />;
    }
    const { shop } = item;
    const isSelected = selectedLocationId === shop.locationId;
    const match =
      !q || String(shop.position).includes(q) || slotLabel(shop).includes(q) || shop.name.toLowerCase().includes(q);
    const targetable = !!dragFromId && dragFromId !== shop.locationId;
    const isDropTarget = targetable && dropTargetId === shop.locationId;

    return (
      <div
        key={shop.locationId}
        ref={(el) => {
          if (el) cellRefs.current.set(shop.locationId, el);
          else cellRefs.current.delete(shop.locationId);
        }}
        onClick={() => onSelectShop(shop.locationId)}
        draggable={!!shop.vendorId}
        title={shop.vendorId ? "ドラッグして別の区画へ移せます（出店者がいれば入れ替え）" : undefined}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", shop.locationId);
          e.dataTransfer.effectAllowed = "move";
          setDragFromId(shop.locationId);
        }}
        onDragEnd={() => {
          setDragFromId(null);
          setDropTargetId(null);
        }}
        onDragOver={(e) => {
          if (!dragFromId || dragFromId === shop.locationId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (dropTargetId !== shop.locationId) setDropTargetId(shop.locationId);
        }}
        onDragLeave={() => {
          if (dropTargetId === shop.locationId) setDropTargetId(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const from = e.dataTransfer.getData("text/plain") || dragFromId;
          setDragFromId(null);
          setDropTargetId(null);
          if (from && from !== shop.locationId) onDropVendor(from, shop.locationId);
        }}
        style={{
          width: 64,
          height: 44,
          flexShrink: 0,
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          cursor: shop.vendorId ? "grab" : "pointer",
          opacity: match || targetable ? 1 : 0.25,
          outline: isDropTarget ? `3px solid ${EDITOR_COLORS.accentBorder}` : undefined,
          background: isSelected ? "#92400E" : shop.vendorId ? "#FFF3DA" : targetable ? "#FFFDF7" : "#F5F1E6",
          border: isSelected
            ? "2px solid #92400E"
            : shop.vendorId
              ? "1px solid #E7C88A"
              : `1px dashed ${targetable ? "#B45309" : "#D8CFB6"}`,
          color: isSelected ? "#fff" : "#57503F",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "monospace" }}>{slotLabel(shop)}</span>
        <span
          style={{
            fontSize: 9.5,
            maxWidth: 56,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {shop.vendorId ? shop.name : "空き"}
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        flexShrink: 0,
        maxHeight: 168,
        borderTop: "1px solid #EDE3CD",
        background: "#FDFBF5",
        overflowY: "auto",
        padding: "10px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {groups.map(({ road, sections }) => (
        <div key={road.id} style={{ display: "flex", alignItems: "flex-start", gap: 22, flexShrink: 0, overflowX: "auto" }}>
          {sections.map((section) => (
            <div key={section.chome} style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#9A8A6A" }}>
                {road.name} {section.chome}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {Array.from({ length: section.columns }, (_, i) => renderCell(section.north[i], `north-empty-${i}`))}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {Array.from({ length: section.columns }, (_, i) => renderCell(section.south[i], `south-empty-${i}`))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
