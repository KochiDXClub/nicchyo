import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_MAP_VIEW_SETTINGS,
  MAP_VIEW_LIMITS,
  containsRouteBounds,
  isSameMapViewSettings,
  mapViewSettingsFromRow,
  mapViewSettingsToRow,
  normalizeMapViewBounds,
  normalizeMapViewSettings,
  resolveMapViewBounds,
  toLngLatBoundsPair,
  toMapViewBounds,
  validateMapViewSettingsPatch,
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

describe("validateMapViewSettingsPatch", () => {
  const base = { ...DEFAULT_MAP_VIEW_SETTINGS, paddingMeters: 300, minZoom: 14 };

  it("送られてこなかった項目はいまの値を引き継ぐ", () => {
    const result = validateMapViewSettingsPatch({ mode: "auto" }, base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.paddingMeters).toBe(300);
    expect(result.settings.minZoom).toBe(14);
  });

  it("範囲外の余白は丸めずに弾く", () => {
    const result = validateMapViewSettingsPatch({ paddingMeters: 99999 }, base);
    expect(result.ok).toBe(false);
  });

  it("範囲外の最小ズームは丸めずに弾く", () => {
    expect(validateMapViewSettingsPatch({ minZoom: 1 }, base).ok).toBe(false);
    expect(validateMapViewSettingsPatch({ minZoom: 30 }, base).ok).toBe(false);
  });

  it("知らない決め方は弾く", () => {
    expect(validateMapViewSettingsPatch({ mode: "widest" }, base).ok).toBe(false);
  });

  it("壊れた長方形は auto に倒さず弾く", () => {
    const result = validateMapViewSettingsPatch(
      { mode: "manual", bounds: { north: 33.55, south: 33.57, east: 133.55, west: 133.53 } },
      base
    );
    expect(result.ok).toBe(false);
  });

  it("長方形の無い manual は弾く", () => {
    expect(validateMapViewSettingsPatch({ mode: "manual" }, base).ok).toBe(false);
  });

  it("設定でない値は弾く", () => {
    expect(validateMapViewSettingsPatch(null, base).ok).toBe(false);
    expect(validateMapViewSettingsPatch("広く", base).ok).toBe(false);
  });
});

describe("isSameMapViewSettings", () => {
  const bounds = { north: 33.57, south: 33.55, east: 133.55, west: 133.53 };

  it("同じ内容なら true（同じ保存で監査ログを積まないため）", () => {
    expect(
      isSameMapViewSettings(
        { ...DEFAULT_MAP_VIEW_SETTINGS, bounds },
        { ...DEFAULT_MAP_VIEW_SETTINGS, bounds: { ...bounds } }
      )
    ).toBe(true);
  });

  it("長方形の1辺でも違えば false", () => {
    expect(
      isSameMapViewSettings(
        { ...DEFAULT_MAP_VIEW_SETTINGS, mode: "manual", bounds },
        { ...DEFAULT_MAP_VIEW_SETTINGS, mode: "manual", bounds: { ...bounds, north: 33.58 } }
      )
    ).toBe(false);
  });

  it("最小ズームが違えば false", () => {
    expect(
      isSameMapViewSettings(DEFAULT_MAP_VIEW_SETTINGS, { ...DEFAULT_MAP_VIEW_SETTINGS, minZoom: 12 })
    ).toBe(false);
  });
});

/**
 * DBのCHECK制約とコード側の許容範囲は同じ値でなければならない。
 * 片方だけ広げると、画面では通るのに保存で落ちる（またはその逆）状態になる。
 */
describe("マイグレーションとの突き合わせ", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260907150000_create_map_view_settings.sql"),
    "utf8"
  );

  it("余白の上下限がCHECK制約と一致している", () => {
    expect(sql).toContain(
      `padding_meters >= ${MAP_VIEW_LIMITS.paddingMeters.min} and padding_meters <= ${MAP_VIEW_LIMITS.paddingMeters.max}`
    );
  });

  it("最小ズームの上下限がCHECK制約と一致している", () => {
    expect(sql).toContain(
      `min_zoom >= ${MAP_VIEW_LIMITS.minZoom.min} and min_zoom <= ${MAP_VIEW_LIMITS.minZoom.max}`
    );
  });

  it("長方形の一辺の上下限がCHECK制約と一致している", () => {
    const { min, max } = MAP_VIEW_LIMITS.spanDeg;
    expect(sql).toContain(`north - south between ${min} and ${max}`);
    expect(sql).toContain(`east - west between ${min} and ${max}`);
  });

  it("既定値がマイグレーションの初期行と一致している", () => {
    expect(sql).toContain(
      `values ('default', '${DEFAULT_MAP_VIEW_SETTINGS.mode}', ${DEFAULT_MAP_VIEW_SETTINGS.paddingMeters}, ${DEFAULT_MAP_VIEW_SETTINGS.minZoom})`
    );
  });

  it("公開読み取りで updated_by を渡していない（管理者のUUIDが漏れないように）", () => {
    // 列を絞らない grant select だと、行が必ず1行ある以上、
    // 一度でも保存されれば未ログインの来訪者が updated_by を読める
    expect(sql).not.toMatch(/grant select on public\.map_view_settings/i);
    for (const match of sql.matchAll(/grant select \(([^)]*)\)/gi)) {
      expect(match[1]).not.toContain("updated_by");
    }
  });
});
