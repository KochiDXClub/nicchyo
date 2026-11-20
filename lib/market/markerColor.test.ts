import { describe, expect, it } from "vitest";
import {
  DEFAULT_MARKET_MARKER_COLOR,
  SUNDAY_MARKET_MARKER_COLOR,
  isMarkerColor,
  markerColorForRoad,
  resolveMarkerColor,
} from "./markerColor";

const markets = [
  { id: "sun", slug: "nichiyo", markerColor: "#D97706" },
  { id: "thu", slug: "mokuyo", markerColor: "#0EA5E9" },
  { id: "no-color", slug: "kayo", markerColor: null },
];

describe("markerColor", () => {
  it("#RRGGBB だけを色として受け付ける", () => {
    expect(isMarkerColor("#0ea5e9")).toBe(true);
    expect(isMarkerColor("red")).toBe(false);
    expect(isMarkerColor("#fff")).toBe(false);
    expect(isMarkerColor(undefined)).toBe(false);
  });

  it("不正な値は既定色にし、正しい値は大文字にそろえる", () => {
    expect(resolveMarkerColor("nope")).toBe(DEFAULT_MARKET_MARKER_COLOR);
    expect(resolveMarkerColor("#0ea5e9")).toBe("#0EA5E9");
  });

  it("道の市の色を返し、道が無い旧区画は日曜市の色にする", () => {
    expect(markerColorForRoad("thu", markets)).toBe("#0EA5E9");
    expect(markerColorForRoad(null, markets)).toBe("#D97706");
    expect(markerColorForRoad(undefined, [])).toBe(SUNDAY_MARKET_MARKER_COLOR);
  });

  it("色が未設定の市は初期色になる", () => {
    expect(markerColorForRoad("no-color", markets)).toBe(DEFAULT_MARKET_MARKER_COLOR);
  });
});
