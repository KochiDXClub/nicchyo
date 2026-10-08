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
    expect(normalizeMapFeatureFlags({ roadSnap: "bogus", zoomSkip: "after" })).toEqual({
      ...DEFAULT_MAP_FEATURE_FLAGS,
      zoomSkip: "after",
    });
  });

  it("真偽値は on/off/true/false の文字列でも受け付ける", () => {
    expect(normalizeMapFeatureFlags({ zoomRenderIsolation: "off", landmarkCssScale: "true" })).toEqual({
      ...DEFAULT_MAP_FEATURE_FLAGS,
      zoomRenderIsolation: false,
      landmarkCssScale: true,
    });
  });
});

describe("parseMapFlagsFromSearch / resolveMapFeatureFlags", () => {
  it("?mapFlags= が無ければ上書きしない", () => {
    expect(parseMapFlagsFromSearch("?perf=1")).toBeNull();
    const server = { ...DEFAULT_MAP_FEATURE_FLAGS, roadSnap: "after" as const };
    expect(resolveMapFeatureFlags(server, "?perf=1")).toEqual(server);
  });

  it("URL の指定はサーバー設定より優先し、未指定の項目はサーバー設定を保つ", () => {
    const server = { ...DEFAULT_MAP_FEATURE_FLAGS, roadSnap: "after" as const, zoomRenderIsolation: false };
    const resolved = resolveMapFeatureFlags(server, "?perf=1&mapFlags=roadSnap:off,landmarkCssScale:off");
    expect(resolved).toEqual({
      ...server,
      roadSnap: "off",
      landmarkCssScale: false,
    });
  });

  it("知らないキーや壊れた組は無視する", () => {
    expect(parseMapFlagsFromSearch("?mapFlags=evil:1,roadSnap,zoomSkip:off")).toEqual({ zoomSkip: "off" });
  });

  it("serializeMapFlags は parse と往復できる", () => {
    const flags = { ...DEFAULT_MAP_FEATURE_FLAGS, roadSnap: "off" as const, zoomRenderIsolation: false };
    const parsed = parseMapFlagsFromSearch(`?mapFlags=${serializeMapFlags(flags)}`);
    expect(normalizeMapFeatureFlags(parsed)).toEqual(flags);
  });
});

describe("renderer の既定値", () => {
  it("未保存なら maplibre", () => {
    expect(DEFAULT_MAP_FEATURE_FLAGS.renderer).toBe("maplibre");
    expect(normalizeMapFeatureFlags({}).renderer).toBe("maplibre");
  });

  it("管理画面で leaflet を保存していれば、それを使う（戻せる）", () => {
    expect(normalizeMapFeatureFlags({ renderer: "leaflet" }).renderer).toBe("leaflet");
  });

  it("URL の ?mapFlags=renderer:leaflet で上書きできる", () => {
    expect(resolveMapFeatureFlags(undefined, "?mapFlags=renderer:leaflet").renderer).toBe("leaflet");
  });
});
