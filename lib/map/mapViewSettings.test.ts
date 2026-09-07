import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_VIEW_SETTINGS,
  MAP_VIEW_LIMITS,
  containsRouteBounds,
  mapViewSettingsFromRow,
  mapViewSettingsToRow,
  normalizeMapViewBounds,
  normalizeMapViewSettings,
  resolveMapViewBounds,
  toLngLatBoundsPair,
  toMapViewBounds,
} from "./mapViewSettings";

/** 追手筋のだいたいの範囲（[[北, 東], [南, 西]] の並び） */
const ROUTE_BOUNDS: [[number, number], [number, number]] = [
  [33.5623, 133.5433],
  [33.5606, 133.5337],
];

describe("normalizeMapViewSettings", () => {
  it("値が無ければ既定値に落ちる", () => {
    expect(normalizeMapViewSettings(null)).toEqual(DEFAULT_MAP_VIEW_SETTINGS);
    expect(normalizeMapViewSettings("広く")).toEqual(DEFAULT_MAP_VIEW_SETTINGS);
  });

  it("余白と最小ズームを許容範囲に丸める", () => {
    const settings = normalizeMapViewSettings({ paddingMeters: 99999, minZoom: 1 });
    expect(settings.paddingMeters).toBe(MAP_VIEW_LIMITS.paddingMeters.max);
    expect(settings.minZoom).toBe(MAP_VIEW_LIMITS.minZoom.min);
  });

  it("長方形が無い manual は auto に倒す（可動範囲が決まらないため）", () => {
    expect(normalizeMapViewSettings({ mode: "manual" }).mode).toBe("auto");
  });

  it("長方形があれば manual を保つ", () => {
    const settings = normalizeMapViewSettings({
      mode: "manual",
      bounds: { north: 33.57, south: 33.55, east: 133.55, west: 133.53 },
    });
    expect(settings.mode).toBe("manual");
    expect(settings.bounds?.north).toBe(33.57);
  });
});

describe("normalizeMapViewBounds", () => {
  it("南北・東西が逆の長方形は捨てる", () => {
    expect(
      normalizeMapViewBounds({ north: 33.55, south: 33.57, east: 133.55, west: 133.53 })
    ).toBeNull();
  });

  it("潰れた長方形は捨てる", () => {
    expect(
      normalizeMapViewBounds({ north: 33.5601, south: 33.56, east: 133.5401, west: 133.54 })
    ).toBeNull();
  });

  it("広すぎる長方形は捨てる", () => {
    expect(normalizeMapViewBounds({ north: 40, south: 33, east: 140, west: 133 })).toBeNull();
  });

  it("辺が欠けていれば捨てる", () => {
    expect(normalizeMapViewBounds({ north: 33.57, south: 33.55, east: 133.55 })).toBeNull();
  });
});

describe("resolveMapViewBounds", () => {
  it("auto は道の範囲に余白を足す（余白が大きいほど広い）", () => {
    const narrow = resolveMapViewBounds(
      { ...DEFAULT_MAP_VIEW_SETTINGS, paddingMeters: 100 },
      ROUTE_BOUNDS
    );
    const wide = resolveMapViewBounds(
      { ...DEFAULT_MAP_VIEW_SETTINGS, paddingMeters: 1000 },
      ROUTE_BOUNDS
    );
    expect(wide.north).toBeGreaterThan(narrow.north);
    expect(wide.south).toBeLessThan(narrow.south);
    expect(wide.east).toBeGreaterThan(narrow.east);
    expect(wide.west).toBeLessThan(narrow.west);
  });

  it("manual は保存した長方形をそのまま使う", () => {
    const bounds = { north: 33.58, south: 33.54, east: 133.56, west: 133.52 };
    expect(resolveMapViewBounds({ ...DEFAULT_MAP_VIEW_SETTINGS, mode: "manual", bounds }, ROUTE_BOUNDS)).toEqual(
      bounds
    );
  });

  it("既定の余白は道の全体を含む", () => {
    expect(containsRouteBounds(resolveMapViewBounds(DEFAULT_MAP_VIEW_SETTINGS, ROUTE_BOUNDS), ROUTE_BOUNDS)).toBe(
      true
    );
  });
});

describe("containsRouteBounds", () => {
  it("道がはみ出す長方形は弾く", () => {
    const bounds = { north: 33.5623, south: 33.5606, east: 133.54, west: 133.5337 };
    expect(containsRouteBounds(bounds, ROUTE_BOUNDS)).toBe(false);
  });
});

describe("座標の並び替え", () => {
  it("toMapViewBounds は組の並び順に依存しない", () => {
    const a = toMapViewBounds(ROUTE_BOUNDS);
    const b = toMapViewBounds([ROUTE_BOUNDS[1], ROUTE_BOUNDS[0]]);
    expect(a).toEqual(b);
  });

  it("toLngLatBoundsPair は MapLibre の [[西, 南], [東, 北]] を返す", () => {
    expect(toLngLatBoundsPair({ north: 33.57, south: 33.55, east: 133.55, west: 133.53 })).toEqual([
      [133.53, 33.55],
      [133.55, 33.57],
    ]);
  });
});

describe("DB の行との変換", () => {
  it("行を設定に直す", () => {
    const settings = mapViewSettingsFromRow({
      mode: "manual",
      padding_meters: 300,
      min_zoom: 13,
      north: 33.57,
      south: 33.55,
      east: 133.55,
      west: 133.53,
    });
    expect(settings).toEqual({
      mode: "manual",
      paddingMeters: 300,
      minZoom: 13,
      bounds: { north: 33.57, south: 33.55, east: 133.55, west: 133.53 },
    });
  });

  it("行が無ければ既定値", () => {
    expect(mapViewSettingsFromRow(null)).toEqual(DEFAULT_MAP_VIEW_SETTINGS);
  });

  it("auto に戻しても長方形は残す（また手動に戻せるように）", () => {
    const bounds = { north: 33.57, south: 33.55, east: 133.55, west: 133.53 };
    const row = mapViewSettingsToRow({ ...DEFAULT_MAP_VIEW_SETTINGS, mode: "auto", bounds });
    expect(row.mode).toBe("auto");
    expect(row.north).toBe(33.57);
  });

  it("行 → 設定 → 行 で内容が変わらない", () => {
    const row = {
      mode: "manual" as const,
      padding_meters: 720,
      min_zoom: 15,
      north: 33.57,
      south: 33.55,
      east: 133.55,
      west: 133.53,
    };
    expect(mapViewSettingsToRow(mapViewSettingsFromRow(row))).toEqual(row);
  });
});
