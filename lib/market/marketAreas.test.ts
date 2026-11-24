import { describe, expect, it } from "vitest";
import { MARKET_AREA_LABEL_MAX_LENGTH, moveMarketAreaIds, parseMarketAreaLabel, sortMarketAreas } from "./marketAreas";

describe("parseMarketAreaLabel", () => {
  it("前後の空白を取って、丁目の名前を返す", () => {
    expect(parseMarketAreaLabel("  一丁目 ")).toEqual({ ok: true, label: "一丁目" });
    expect(parseMarketAreaLabel("1丁目")).toEqual({ ok: true, label: "1丁目" });
  });

  it("空・空白だけ・文字数の上限超え・文字列以外は拒否する", () => {
    expect(parseMarketAreaLabel("").ok).toBe(false);
    expect(parseMarketAreaLabel("   ").ok).toBe(false);
    expect(parseMarketAreaLabel("a".repeat(MARKET_AREA_LABEL_MAX_LENGTH + 1)).ok).toBe(false);
    expect(parseMarketAreaLabel(3).ok).toBe(false);
    expect(parseMarketAreaLabel(null).ok).toBe(false);
  });

  it("文字数は書記素ではなく文字で数える（上限ちょうどは通す）", () => {
    expect(parseMarketAreaLabel("あ".repeat(MARKET_AREA_LABEL_MAX_LENGTH)).ok).toBe(true);
  });

  it("改行とタブは拒否する", () => {
    expect(parseMarketAreaLabel("一\n丁目").ok).toBe(false);
    expect(parseMarketAreaLabel("一\t丁目").ok).toBe(false);
  });
});

describe("sortMarketAreas", () => {
  it("sortOrder の小さい順に並べ、元の配列は変えない", () => {
    const areas = [
      { id: "b", marketId: "m", label: "二丁目", sortOrder: 2 },
      { id: "a", marketId: "m", label: "一丁目", sortOrder: 1 },
    ];
    expect(sortMarketAreas(areas).map((area) => area.id)).toEqual(["a", "b"]);
    expect(areas[0].id).toBe("b");
  });
});

describe("moveMarketAreaIds", () => {
  const ids = ["a", "b", "c"];

  it("上・下へ1つ動かした並びを返す", () => {
    expect(moveMarketAreaIds(ids, "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveMarketAreaIds(ids, "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("端から外へは動かせず、無い id も null", () => {
    expect(moveMarketAreaIds(ids, "a", -1)).toBeNull();
    expect(moveMarketAreaIds(ids, "c", 1)).toBeNull();
    expect(moveMarketAreaIds(ids, "x", 1)).toBeNull();
  });

  it("元の並びは変えない", () => {
    moveMarketAreaIds(ids, "b", -1);
    expect(ids).toEqual(["a", "b", "c"]);
  });
});
