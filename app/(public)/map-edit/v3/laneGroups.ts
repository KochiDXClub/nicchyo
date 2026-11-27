import { projectOntoRoad } from "@/lib/map/roadSlotPosition";
import { CHOME_WEST_TO_EAST, type EditableRoad, type EditableShop } from "./types";

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
 * キーボード/WASDでの区画間ナビゲーション（useLaneKeyboardNavigation）と
 * MapEditClientV3 の両方が同じ並び順を参照できるよう、ここに1本化する。
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
