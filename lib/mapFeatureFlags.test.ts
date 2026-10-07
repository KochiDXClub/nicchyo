import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_FEATURE_FLAGS,
  normalizeMapFeatureFlags,
  parseMapFlagsFromSearch,
  resolveMapFeatureFlags,
  serializeMapFlags,
} from "./mapFeatureFlags";

describe("normalizeMapFeatureFlags", () => {
  it("不正な値や欠けた項目は既定値で埋める", () => {
    expect(normalizeMapFeatureFlags(null)).toEqual(DEFAULT_MAP_FEATURE_FLAGS);
    expect(normalizeMapFeatureFlags({ roadSnap: "bogus", crowd: "sprite" })).toEqual({
      ...DEFAULT_MAP_FEATURE_FLAGS,
      crowd: "sprite",
    });
  });

  it("真偽値は on/off/true/false の文字列でも受け付ける", () => {
    expect(normalizeMapFeatureFlags({ tileOpacityByZoom: "off" })).toEqual({
      ...DEFAULT_MAP_FEATURE_FLAGS,
      tileOpacityByZoom: false,
    });
    expect(normalizeMapFeatureFlags({ tileOpacityByZoom: "true" }).tileOpacityByZoom).toBe(true);
  });
});

describe("parseMapFlagsFromSearch / resolveMapFeatureFlags", () => {
  it("?mapFlags= が無ければ上書きしない", () => {
    expect(parseMapFlagsFromSearch("?perf=1")).toBeNull();
    const server = { ...DEFAULT_MAP_FEATURE_FLAGS, roadSnap: "after" as const };
    expect(resolveMapFeatureFlags(server, "?perf=1")).toEqual(server);
  });

  it("URL の指定はサーバー設定より優先し、未指定の項目はサーバー設定を保つ", () => {
    const server = { ...DEFAULT_MAP_FEATURE_FLAGS, roadSnap: "after" as const, tileOpacityByZoom: false };
    const resolved = resolveMapFeatureFlags(server, "?perf=1&mapFlags=roadSnap:off,crowd:sprite");
    expect(resolved).toEqual({
      ...server,
      roadSnap: "off",
      crowd: "sprite",
    });
  });

  it("知らないキーや壊れた組は無視する", () => {
    expect(parseMapFlagsFromSearch("?mapFlags=evil:1,roadSnap,crowd:sprite")).toEqual({ crowd: "sprite" });
  });

  it("serializeMapFlags は parse と往復できる", () => {
    const flags = { ...DEFAULT_MAP_FEATURE_FLAGS, roadSnap: "off" as const, tileOpacityByZoom: false };
    const parsed = parseMapFlagsFromSearch(`?mapFlags=${serializeMapFlags(flags)}`);
    expect(normalizeMapFeatureFlags(parsed)).toEqual(flags);
  });
});

describe("廃止したキー", () => {
  it("保存済みの設定に廃止したキー（renderer など）が残っていても無視する（設定を壊さない）", () => {
    const flags = normalizeMapFeatureFlags({
      renderer: "leaflet",
      zoomSkip: "after",
      stallRenderer: "div",
      roadSnap: "off",
    });
    expect(flags).toEqual({ ...DEFAULT_MAP_FEATURE_FLAGS, roadSnap: "off" });
  });

  it("URL の ?mapFlags= に廃止したキーがあっても無視する", () => {
    expect(parseMapFlagsFromSearch("?mapFlags=renderer:leaflet,zoomSkip:off")).toBeNull();
  });

  it("廃止した背景オーバーレイの svg は既定値に戻す", () => {
    expect(normalizeMapFeatureFlags({ backgroundOverlay: "svg" }).backgroundOverlay).toBe("webp");
  });
});
