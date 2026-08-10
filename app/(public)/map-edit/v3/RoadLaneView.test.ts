import { describe, it, expect } from "vitest";
import { sideOfShop } from "./RoadLaneView";
import { createProjection } from "./geo";
import type { EditableRoad, EditableShop } from "./types";

function makeShop(overrides: Partial<EditableShop>): EditableShop {
  return {
    locationId: "loc-1",
    id: 1,
    name: "テスト店",
    lat: 33.56,
    lng: 133.53,
    position: 1,
    ...overrides,
  };
}

describe("sideOfShop", () => {
  // 東西に伸びる道（緯度は一定、経度が増加する2点）
  const road: EditableRoad = {
    id: "main",
    name: "追手筋",
    kind: "market",
    widthMeters: 30,
    points: [
      { id: "p0", lat: 33.56, lng: 133.53, order: 0, roadId: "main" },
      { id: "p1", lat: 33.56, lng: 133.54, order: 1, roadId: "main" },
    ],
  };
  const projection = createProjection(33.56, 133.535);

  it("classifies a shop north of an east-west road as north", () => {
    const shop = makeShop({ lat: 33.5605, lng: 133.535 });
    expect(sideOfShop(shop, road, projection).side).toBe("north");
  });

  it("classifies a shop south of an east-west road as south", () => {
    const shop = makeShop({ lat: 33.5595, lng: 133.535 });
    expect(sideOfShop(shop, road, projection).side).toBe("south");
  });

  it("orders shops along the road by their projected position", () => {
    const near = makeShop({ locationId: "near", lat: 33.5605, lng: 133.531 });
    const far = makeShop({ locationId: "far", lat: 33.5605, lng: 133.539 });
    expect(sideOfShop(near, road, projection).order).toBeLessThan(sideOfShop(far, road, projection).order);
  });

  it("falls back to north with order 0 when the road has no points", () => {
    const emptyRoad: EditableRoad = { ...road, points: [] };
    const shop = makeShop({});
    expect(sideOfShop(shop, emptyRoad, projection)).toEqual({ side: "north", order: 0 });
  });
});
