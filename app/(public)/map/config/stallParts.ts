/**
 * 屋台パーツのカタログ（SVG パス定義）
 *
 * 【目的】
 * 屋台イラストを「形（パス）」と「色（CSS 変数）」に分けて持つ。
 * - 今は Leaflet の DivIcon にインライン SVG として描く
 * - 将来 MapLibre に移行するときは、同じパスを SDF スプライトに変換して使う
 * - 出店者が屋根の形やひさしの柄を選ぶカスタマイズも、ここに形を足すだけで増やせる
 *
 * 【座標系】
 * すべてのパーツは 100×100 の viewBox に描く。地面は y=100 付近。
 * 実際の表示サイズは ILLUSTRATION_SIZES（displayConfig.ts）で決まり、
 * svg 要素の width/height に入れる。
 *
 * 【色】
 * パスに色を直接書かない。fill はクラス経由で globals.css が当てる。
 *   .stall-roof            → var(--stall-color)
 *   .stall-roof-light      → 白の半透明（ハイライト）
 *   .stall-awning-base     → var(--stall-color-light)
 *   .stall-awning-stripe   → var(--stall-color)
 * 検索・AI・買い物袋などの状態色は CSS が同じクラスに対して fill を上書きする。
 * SDF は単色前提なので、グラデーションは使わず「単色＋半透明のハイライト」で表現する。
 */

export type StallRoofShape = "gable" | "flat" | "arch" | "parasol";
export type StallAwningPattern = "stripe" | "plain" | "scallop";

export interface StallPartsSpec {
  roof: StallRoofShape;
  awning: StallAwningPattern;
}

export const DEFAULT_STALL_PARTS: StallPartsSpec = {
  roof: "gable",
  awning: "stripe",
};

export const STALL_ROOF_SHAPES: readonly StallRoofShape[] = ["gable", "flat", "arch", "parasol"];
export const STALL_AWNING_PATTERNS: readonly StallAwningPattern[] = ["stripe", "plain", "scallop"];

export const STALL_VIEWBOX = 100;

/**
 * 屋根。
 * gable は従来の CSS 版（skewX(-12deg) した角丸長方形）を再現している。
 * 各エントリは { d, transform?, light } で、light は上に重ねるハイライトのパス。
 */
interface RoofDef {
  /** 屋根本体 */
  d: string;
  /** 本体に掛ける transform（skew など） */
  transform?: string;
  /** ハイライト（白の半透明で上に重ねる） */
  light: string;
}

const ROOF_DEFS: Record<StallRoofShape, RoofDef> = {
  // 上辺 y=4、高さ 30、左右 5〜95、角丸 上8 下4、中心 (50,19) で skewX(-12)
  gable: {
    d: "M13,4 H87 A8,8 0 0 1 95,12 V30 A4,4 0 0 1 91,34 H9 A4,4 0 0 1 5,30 V12 A8,8 0 0 1 13,4 Z",
    transform: "translate(50 19) skewX(-12) translate(-50 -19)",
    light: "M13,4 H60 L48,34 H9 A4,4 0 0 1 5,30 V12 A8,8 0 0 1 13,4 Z",
  },
  // 平らな庇。skew なし
  flat: {
    d: "M8,10 H92 A3,3 0 0 1 95,13 V29 A3,3 0 0 1 92,32 H8 A3,3 0 0 1 5,29 V13 A3,3 0 0 1 8,10 Z",
    light: "M8,10 H56 L46,32 H8 A3,3 0 0 1 5,29 V13 A3,3 0 0 1 8,10 Z",
  },
  // かまぼこ屋根
  arch: {
    d: "M5,34 Q50,-6 95,34 Z",
    light: "M5,34 Q30,6 52,4 Q38,14 34,34 Z",
  },
  // パラソル。下辺が波打つ
  parasol: {
    d: "M50,4 L95,30 Q84,36 73,30 Q61,36 50,30 Q39,36 28,30 Q16,36 5,30 Z",
    light: "M50,4 L28,30 Q16,36 5,30 Z",
  },
};

/**
 * ひさし。
 * 基本は x=8〜92、y=28〜44 の帯。stripe は従来の CSS 版（10% 幅の縞、skewX(-10deg)）を再現。
 */
interface AwningDef {
  /** 下地 */
  base: string;
  /** 縞や飾り。無い柄は空文字 */
  accent: string;
  transform?: string;
}

function buildStripes(): string {
  // 84 幅を 10% ずつ、濃い縞は 0-10%, 20-30%, ... の 5 本
  const x0 = 8;
  const w = 84;
  const bar = w * 0.1;
  const parts: string[] = [];
  for (let k = 0; k < 5; k++) {
    const x = x0 + k * bar * 2;
    parts.push(`M${x.toFixed(1)},28 h${bar.toFixed(1)} v16 h-${bar.toFixed(1)} Z`);
  }
  return parts.join(" ");
}

function buildScallops(): string {
  // 帯の下辺に 6 個の半円を垂らす
  const segments: string[] = ["M8,28 H92 V42"];
  for (let k = 0; k < 6; k++) {
    segments.push("a7,5 0 0 1 -14,0");
  }
  segments.push("Z");
  return segments.join(" ");
}

const AWNING_DEFS: Record<StallAwningPattern, AwningDef> = {
  stripe: {
    base: "M12,28 H88 A4,4 0 0 1 92,32 V40 A4,4 0 0 1 88,44 H12 A4,4 0 0 1 8,40 V32 A4,4 0 0 1 12,28 Z",
    accent: buildStripes(),
    transform: "translate(50 36) skewX(-10) translate(-50 -36)",
  },
  plain: {
    base: "M12,28 H88 A4,4 0 0 1 92,32 V40 A4,4 0 0 1 88,44 H12 A4,4 0 0 1 8,40 V32 A4,4 0 0 1 12,28 Z",
    accent: "",
    transform: "translate(50 36) skewX(-10) translate(-50 -36)",
  },
  scallop: {
    base: buildScallops(),
    accent: "",
  },
};

/** 本体・カウンター・脚・影は当面 1 種類（色も固定） */
const BODY_PATH =
  "M16,40 H84 A6,6 0 0 1 90,46 V76 A6,6 0 0 1 84,82 H16 A6,6 0 0 1 10,76 V46 A6,6 0 0 1 16,40 Z";
const COUNTER_PATH =
  "M16,54 H84 A4,4 0 0 1 88,58 V68 A4,4 0 0 1 84,72 H16 A4,4 0 0 1 12,68 V58 A4,4 0 0 1 16,54 Z";
const LEGS_PATH = "M18,82 h7.7 v12 h-7.7 Z M46.2,82 h7.7 v12 h-7.7 Z M74.3,82 h7.7 v12 h-7.7 Z";

export function resolveStallParts(spec?: Partial<StallPartsSpec> | null): StallPartsSpec {
  const roof = spec?.roof && ROOF_DEFS[spec.roof] ? spec.roof : DEFAULT_STALL_PARTS.roof;
  const awning =
    spec?.awning && AWNING_DEFS[spec.awning] ? spec.awning : DEFAULT_STALL_PARTS.awning;
  return { roof, awning };
}

/**
 * 屋台 1 体ぶんの SVG マークアップを返す。
 * 色は付けない（globals.css が .stall-* クラスに fill を当てる）。
 */
export function generateStallSvg(
  spec: StallPartsSpec,
  size: { width: number; height: number }
): string {
  const roof = ROOF_DEFS[spec.roof];
  const awning = AWNING_DEFS[spec.awning];
  const roofTransform = roof.transform ? ` transform="${roof.transform}"` : "";
  const awningTransform = awning.transform ? ` transform="${awning.transform}"` : "";
  const awningAccent = awning.accent
    ? `<path class="stall-awning-stripe" d="${awning.accent}"/>`
    : "";

  return (
    `<svg class="shop-illustration shop-illustration-svg" viewBox="0 0 ${STALL_VIEWBOX} ${STALL_VIEWBOX}" ` +
    `width="${size.width}" height="${size.height}" aria-hidden="true" focusable="false">` +
    `<ellipse class="stall-shadow" cx="50" cy="91" rx="42" ry="7"/>` +
    `<path class="stall-legs" d="${LEGS_PATH}"/>` +
    `<path class="stall-body" d="${BODY_PATH}"/>` +
    `<path class="stall-counter" d="${COUNTER_PATH}"/>` +
    `<g${awningTransform}>` +
    `<path class="stall-awning stall-awning-base" d="${awning.base}"/>` +
    awningAccent +
    `</g>` +
    `<g${roofTransform}>` +
    `<path class="stall-roof" d="${roof.d}"/>` +
    `<path class="stall-roof-light" d="${roof.light}"/>` +
    `</g>` +
    `</svg>`
  );
}

/** スプライト用の色。CSS 変数の代わりに明示的な色を焼き込む */
export interface StallSpriteColors {
  roof: string;
  awningBase: string;
  awningStripe: string;
  /** 選択などの縁取り。無ければ描かない */
  outline?: string;
}

/**
 * MapLibre のシンボルレイヤー用に、色を焼き込んだ単体 SVG を返す。
 * inline SVG 版（generateStallSvg）は CSS の fill に頼るが、画像として描き起こすときは
 * スタイルシートが効かないので、ここでは fill 属性を直接書く。
 * 形の定義は同じカタログを使うので、両方式で見た目が揃う。
 */
export function generateStallSpriteSvg(
  spec: StallPartsSpec,
  colors: StallSpriteColors,
  size: { width: number; height: number }
): string {
  const roof = ROOF_DEFS[spec.roof];
  const awning = AWNING_DEFS[spec.awning];
  const roofTransform = roof.transform ? ` transform="${roof.transform}"` : "";
  const awningTransform = awning.transform ? ` transform="${awning.transform}"` : "";
  const outline = colors.outline
    ? ` stroke="${colors.outline}" stroke-width="3" stroke-linejoin="round"`
    : "";
  const awningAccent = awning.accent
    ? `<path d="${awning.accent}" fill="${colors.awningStripe}"/>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STALL_VIEWBOX} ${STALL_VIEWBOX}" ` +
    `width="${size.width}" height="${size.height}">` +
    `<ellipse cx="50" cy="91" rx="42" ry="7" fill="rgba(0,0,0,0.16)"/>` +
    `<path d="${LEGS_PATH}" fill="#8b5e34"/>` +
    `<path d="${BODY_PATH}" fill="#f1ede6" stroke="${colors.outline ?? "rgba(90,80,70,0.4)"}" stroke-width="${colors.outline ? 3 : 2}" stroke-linejoin="round"/>` +
    `<path d="${COUNTER_PATH}" fill="#ec9a0c"/>` +
    `<g${awningTransform}>` +
    `<path d="${awning.base}" fill="${colors.awningBase}"${outline}/>` +
    awningAccent +
    `</g>` +
    `<g${roofTransform}>` +
    `<path d="${roof.d}" fill="${colors.roof}"${outline}/>` +
    `<path d="${roof.light}" fill="#ffffff" opacity="0.22"/>` +
    `</g>` +
    `</svg>`
  );
}
