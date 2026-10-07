import { describe, expect, it } from "vitest";
import type { Shop } from "../../data/shops";
import {
  buildShopFeatures,
  diffShopDisplay,
  shopsToGeoJSON,
  type ShopDisplayState,
} from "./shopFeatures";

const shop = (id: number, extra: Partial<Shop> = {}) =>
  ({ id, name: `店${id}`, category: "野菜", lat: 33.5614 + id * 0.00001, lng: 133.5379, ...extra }) as unknown as Shop;

const display = (states: [number, "search" | "ai" | "selected"][] = [], favorites: number[] = []): ShopDisplayState => ({
  states: new Map(states),
  favorites: new Set(favorites),
});

describe("buildShopFeatures", () => {
  it("customSvg の店も屋台レイヤーに載せ、店ごとの専用スプライトを指す", () => {
    const svg = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>';
    const features = buildShopFeatures([
      shop(1),
      shop(2, { illustration: { type: "tent", customSvg: svg } } as Partial<Shop>),
    ]);
    expect(features.map((f) => f.id)).toEqual([1, 2]);
    expect(features[0].properties.spriteKey).not.toMatch(/^custom-/);
    expect(features[1].properties.spriteKey).toMatch(/^custom-2-/);
  });

  it("不正な customSvg（許可外のタグ）は通常の屋台に戻す", () => {
    const [f] = buildShopFeatures([
      shop(3, { illustration: { type: "tent", customSvg: "<svg><script>alert(1)</script></svg>" } } as Partial<Shop>),
    ]);
    expect(f.properties.spriteKey).not.toMatch(/^custom-/);
  });

  it("customSvg の中身が変わると spriteKey も変わる（古い画像を使い回さない）", () => {
    const a = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>';
    const b = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="blue"/></svg>';
    const key = (svg: string) =>
      buildShopFeatures([shop(2, { illustration: { type: "tent", customSvg: svg } } as Partial<Shop>)])[0].properties.spriteKey;
    expect(key(a)).not.toBe(key(b));
  });

  it("表示状態（state / favorite）は含めない", () => {
    const [f] = buildShopFeatures([shop(1)]);
    expect(f.properties).not.toHaveProperty("state");
    expect(f.properties).not.toHaveProperty("favorite");
    expect(f.properties).toMatchObject({ id: 1, name: "店1" });
  });
});

describe("shopsToGeoJSON", () => {
  it("変わらない属性に表示状態を重ねる", () => {
    const features = buildShopFeatures([shop(1), shop(2)]);
    const fc = shopsToGeoJSON(features, display([[2, "selected"]], [1]));
    expect(fc.features.map((f) => [f.properties?.state, f.properties?.favorite])).toEqual([
      ["normal", true],
      ["selected", false],
    ]);
    expect(fc.features[0].properties).toMatchObject(features[0].properties);
  });

  it("元の Feature を書き換えない（使い回すため）", () => {
    const features = buildShopFeatures([shop(1)]);
    shopsToGeoJSON(features, display([[1, "ai"]]));
    expect(features[0].properties).not.toHaveProperty("state");
  });
});

describe("diffShopDisplay", () => {
  const features = buildShopFeatures([shop(1), shop(2), shop(3)]);

  it("変わらなければ空", () => {
    expect(diffShopDisplay(features, display([[1, "ai"]]), display([[1, "ai"]]))).toEqual([]);
  });

  it("選択が移ったら、外れた店と選ばれた店の 2 件だけ", () => {
    const diff = diffShopDisplay(features, display([[1, "selected"]]), display([[3, "selected"]]));
    expect(diff).toEqual([
      {
        id: 1,
        addOrUpdateProperties: [
          { key: "state", value: "normal" },
          { key: "favorite", value: false },
        ],
      },
      {
        id: 3,
        addOrUpdateProperties: [
          { key: "state", value: "selected" },
          { key: "favorite", value: false },
        ],
      },
    ]);
  });

  it("お気に入りの切り替えも差分に出る", () => {
    const diff = diffShopDisplay(features, display(), display([], [2]));
    expect(diff.map((u) => u.id)).toEqual([2]);
    expect(diff[0].addOrUpdateProperties).toContainEqual({ key: "favorite", value: true });
  });
});
