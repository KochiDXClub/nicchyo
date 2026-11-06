import { describe, expect, it } from "vitest";
import { placeMapFeatures } from "./SchedulePlaceMap";
import type { PlaceRow } from "@/lib/market-schedule/adminTypes";
const place = (id: string, latitude: number | null, longitude: number | null): PlaceRow => ({ id, store_number: 3, official_number: 183, branch_number: 1, district: null, place_name: null, latitude, longitude });
describe("出店場所の地図", () => {
  it("有効な座標の場所だけを表示し、選択と枝番号を反映する", () => {
    const features = placeMapFeatures([place("a", 33.56, 133.53), place("b", null, 133.5), place("c", 0, 0)], "a").features;
    expect(features).toHaveLength(1);
    expect(features[0].geometry.coordinates).toEqual([133.53, 33.56]);
    expect(features[0].properties).toMatchObject({ id: "a", label: "183-1", selected: true });
  });
});
