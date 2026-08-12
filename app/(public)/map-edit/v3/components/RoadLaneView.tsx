"use client";

import { useEffect, useMemo, useRef } from "react";
import { projectPointOntoRoute } from "../../../map/utils/mapRouteGeometry";
import type { Projection } from "../geo";
import { CHOME_ORDER, type EditableRoad, type EditableShop, type SlotAction } from "../types";

type Side = "north" | "south";

type LaneShop = { shop: EditableShop; side: Side; order: number };

type Section = {
  chome: string;
  north: LaneShop[];
  south: LaneShop[];
  columns: number;
};

export function sideOfShop(shop: EditableShop, road: EditableRoad, projection: Projection): { side: Side; order: number } {
  const projection2 = projectPointOntoRoute({ lat: shop.lat, lng: shop.lng }, road.points);
  if (!projection2) return { side: "north", order: 0 };

  const a = road.points[projection2.segmentIndex];
  const b = road.points[projection2.segmentIndex + 1];
  if (!a || !b) return { side: "north", order: projection2.segmentIndex };

  const aLocal = projection.toLocal(a.lat, a.lng);
  const bLocal = projection.toLocal(b.lat, b.lng);
  const shopLocal = projection.toLocal(shop.lat, shop.lng);
  const tangent = { x: bLocal.x - aLocal.x, y: bLocal.y - aLocal.y };
  const toShop = { x: shopLocal.x - aLocal.x, y: shopLocal.y - aLocal.y };
  const cross = tangent.x * toShop.y - tangent.y * toShop.x;

  return {
    side: cross <= 0 ? "north" : "south",
    order: projection2.segmentIndex + projection2.t,
  };
}

export default function RoadLaneView({
  shops,
  roads,
  projection,
  selectedLocationId,
  slotAction,
  search,
  onSelectShop,
  findNearestRoadId,
}: {
  shops: EditableShop[];
  roads: EditableRoad[];
  projection: Projection;
  selectedLocationId: string | null;
  slotAction: SlotAction;
  search: string;
  onSelectShop: (locationId: string) => void;
  findNearestRoadId: (point: { lat: number; lng: number }) => string | null;
}) {
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const q = search.trim().toLowerCase();

  const roadGroups = useMemo(() => {
    const marketRoads = roads.filter((r) => r.kind === "market" && r.points.length >= 2);

    return marketRoads
      .map((road) => {
        const shopsOnRoad = shops.filter((s) => findNearestRoadId({ lat: s.lat, lng: s.lng }) === road.id);
        const byChome = new Map<string, EditableShop[]>();
        for (const shop of shopsOnRoad) {
          const key = shop.chome ?? "その他";
          const list = byChome.get(key) ?? [];
          list.push(shop);
          byChome.set(key, list);
        }

        const orderedChomeKeys = [...CHOME_ORDER, "その他"].filter((key) => byChome.has(key));
        const sections: Section[] = orderedChomeKeys.map((chome) => {
          const withSide = byChome.get(chome)!.map((shop) => ({ shop, ...sideOfShop(shop, road, projection) }));
          const north = withSide.filter((m) => m.side === "north").sort((a, b) => a.order - b.order);
          const south = withSide.filter((m) => m.side === "south").sort((a, b) => a.order - b.order);
          return { chome, north, south, columns: Math.max(north.length, south.length) };
        });

        return { road, sections };
      })
      .filter((group) => group.sections.length > 0);
  }, [roads, shops, findNearestRoadId, projection]);

  useEffect(() => {
    if (!selectedLocationId) return;
    const el = cellRefs.current.get(selectedLocationId);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedLocationId]);

  if (roadGroups.length === 0) return null;

  const renderCell = (item: LaneShop | undefined) => {
    if (!item) {
      return <div style={{ width: 64, height: 44, flexShrink: 0 }} />;
    }
    const { shop } = item;
    const isSelected = selectedLocationId === shop.locationId;
    const match = !q || String(shop.position).includes(q) || shop.name.toLowerCase().includes(q);
    const targetable = (slotAction === "move" || slotAction === "place") && !shop.vendorId;

    return (
      <div
        key={shop.locationId}
        ref={(el) => {
          if (el) cellRefs.current.set(shop.locationId, el);
          else cellRefs.current.delete(shop.locationId);
        }}
        onClick={() => onSelectShop(shop.locationId)}
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
          cursor: "pointer",
          opacity: match ? 1 : 0.25,
          background: isSelected ? "#92400E" : shop.vendorId ? "#FFF3DA" : targetable ? "#FFFDF7" : "#F5F1E6",
          border: isSelected
            ? "2px solid #92400E"
            : shop.vendorId
              ? "1px solid #E7C88A"
              : `1px dashed ${targetable ? "#B45309" : "#D8CFB6"}`,
          color: isSelected ? "#fff" : "#57503F",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 900, fontFamily: "monospace" }}>{shop.position}</span>
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
      {roadGroups.map(({ road, sections }) => (
        <div key={road.id} style={{ display: "flex", alignItems: "flex-start", gap: 22, flexShrink: 0, overflowX: "auto" }}>
          {sections.map((section) => (
            <div key={section.chome} style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#9A8A6A" }}>
                {road.name} {section.chome}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {Array.from({ length: section.columns }, (_, i) => renderCell(section.north[i]))}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {Array.from({ length: section.columns }, (_, i) => renderCell(section.south[i]))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
