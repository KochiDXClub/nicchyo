/**
 * マップ描画の動作フラグ
 *
 * パフォーマンス改善で入れた仕組みを、実験時にも本番でもオン・オフできるようにする。
 *
 * 優先順位（強い順）:
 *   1. URL の ?mapFlags=roadSnap:after,zoomSkip:off   … 計測ページや手元の実験用
 *   2. 管理画面「設定」で保存した値（system_settings の key = "map_flags"）… 本番の切替用
 *   3. ここの既定値
 *
 * サーバー側では (2) を読んで MapPageClient に渡し、クライアント側で (1) を上書きする。
 * フラグを増やすときは MapFeatureFlags と MAP_FEATURE_FLAG_DEFS の両方に足す。
 * 設定画面と計測ページのスイッチは MAP_FEATURE_FLAG_DEFS から自動生成される。
 */

export type RoadSnapMode = "off" | "after" | "integrated";
export type ZoomSkipMode = "off" | "after" | "before";

export interface MapFeatureFlags {
  /**
   * ズームイン後に地図の中心を道の上へ寄せる方法。
   * - off: 寄せない
   * - after: ズーム終了後に 350ms のパンで寄せる（従来）
   * - integrated: ズームの目標中心をあらかじめ道の上にし、1 回のアニメーションで済ませる
   *   （ずらし量が画面外のときとピンチ操作中は after と同じ扱いになる）
   */
  roadSnap: RoadSnapMode;
  /**
   * ズーム 18 ちょうど（丁目表示の切替境界）に止まらないための逃がし方。
   * - off: 逃がさない
   * - after: ズーム終了後にもう一度 setZoom で ±0.03 逃がす（従来。ズームが 2 回走る）
   * - before: Leaflet がズーム先を確定する時点で逃がす（1 回で済む）
   */
  zoomSkip: ZoomSkipMode;
  /** ズーム値ではなく「表示モードの真偽値」だけを state に持ち、モードが変わらないズームでは MapView を再描画しない */
  zoomRenderIsolation: boolean;
  /** ランドマーク画像の倍率をズームごとの DivIcon 再生成ではなく CSS 変数で追従させる */
  landmarkCssScale: boolean;
}

/**
 * 既定値。
 * roadSnap は 2026-09-03 の計測（CPU 4 倍、300 店舗、2 回）で integrated の優位が確認できなかったため
 * 従来の after のまま。integrated は管理画面か ?mapFlags=roadSnap:integrated で試せる。
 */
export const DEFAULT_MAP_FEATURE_FLAGS: MapFeatureFlags = {
  roadSnap: "after",
  zoomSkip: "before",
  zoomRenderIsolation: true,
  landmarkCssScale: true,
};

export const ROAD_SNAP_MODES: readonly RoadSnapMode[] = ["off", "after", "integrated"];
export const ZOOM_SKIP_MODES: readonly ZoomSkipMode[] = ["off", "after", "before"];

export type MapFeatureFlagKey = keyof MapFeatureFlags;

export interface MapFeatureFlagDef {
  key: MapFeatureFlagKey;
  label: string;
  description: string;
  /** 選択肢。boolean なら on/off のチェックボックス */
  options: readonly string[] | "boolean";
}

/** 設定画面と計測ページのスイッチはこの配列から自動生成する */
export const MAP_FEATURE_FLAG_DEFS: readonly MapFeatureFlagDef[] = [
  {
    key: "roadSnap",
    label: "ズーム後の道への吸着",
    description: "off: 寄せない / after: ズーム後にパンで寄せる（従来） / integrated: ズームと同時に寄せる",
    options: ROAD_SNAP_MODES,
  },
  {
    key: "zoomSkip",
    label: "ズーム 18 の回避",
    description: "off: 回避しない / after: ズーム後にもう一度ズームして逃がす（従来） / before: ズーム先の確定時に逃がす",
    options: ZOOM_SKIP_MODES,
  },
  {
    key: "zoomRenderIsolation",
    label: "ズーム時の再描画を抑える",
    description: "表示モードが変わらないズームではマップ全体を再描画しない",
    options: "boolean",
  },
  {
    key: "landmarkCssScale",
    label: "ランドマークを CSS で拡縮",
    description: "ズームごとにアイコンを作り直さず、CSS の倍率で追従させる",
    options: "boolean",
  },
];

/** 後方互換: 以前の個別ラベル参照用 */
export const MAP_FEATURE_FLAG_LABELS: Record<MapFeatureFlagKey, { label: string; description: string }> =
  Object.fromEntries(MAP_FEATURE_FLAG_DEFS.map((d) => [d.key, { label: d.label, description: d.description }])) as Record<
    MapFeatureFlagKey,
    { label: string; description: string }
  >;

function readBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "on" || value === "true" || value === "1") return true;
  if (value === "off" || value === "false" || value === "0") return false;
  return fallback;
}

/** 保存された JSON や URL 由来の部分的な値を、既定値で埋めて正規化する */
export function normalizeMapFeatureFlags(
  value: unknown,
  base: MapFeatureFlags = DEFAULT_MAP_FEATURE_FLAGS
): MapFeatureFlags {
  if (!value || typeof value !== "object") return base;
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  for (const def of MAP_FEATURE_FLAG_DEFS) {
    const raw = record[def.key];
    if (def.options === "boolean") {
      out[def.key] = readBool(raw, base[def.key] as boolean);
    } else if (typeof raw === "string" && def.options.includes(raw)) {
      out[def.key] = raw;
    }
  }
  return out as unknown as MapFeatureFlags;
}

/**
 * URL の ?mapFlags=roadSnap:after,zoomSkip:off,zoomRenderIsolation:off を読む。
 * フラグが無ければ null（上書きなし）。
 */
export function parseMapFlagsFromSearch(search: string): Partial<Record<MapFeatureFlagKey, string>> | null {
  const raw = new URLSearchParams(search).get("mapFlags");
  if (!raw) return null;
  const out: Partial<Record<MapFeatureFlagKey, string>> = {};
  for (const pair of raw.split(",")) {
    const [key, val] = pair.split(":").map((s) => s.trim());
    if (!key || !val) continue;
    if (MAP_FEATURE_FLAG_DEFS.some((d) => d.key === key)) {
      out[key as MapFeatureFlagKey] = val;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** サーバー由来の設定に URL の上書きを重ねる */
export function resolveMapFeatureFlags(
  serverFlags: MapFeatureFlags | undefined,
  search: string
): MapFeatureFlags {
  const base = serverFlags ?? DEFAULT_MAP_FEATURE_FLAGS;
  const override = parseMapFlagsFromSearch(search);
  return override ? normalizeMapFeatureFlags(override, base) : base;
}

/** ?mapFlags= 用の文字列に戻す（計測ページが iframe の URL を組むときに使う） */
export function serializeMapFlags(flags: Partial<MapFeatureFlags>): string {
  return Object.entries(flags)
    .map(([k, v]) => `${k}:${typeof v === "boolean" ? (v ? "on" : "off") : v}`)
    .join(",");
}
