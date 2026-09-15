/**
 * 分析ページのチャート用トークン。
 *
 * 色は「役割」で決めている（識別＝カテゴリカル / 量＝シーケンシャル / 向き＝ダイバージング）。
 * カテゴリカルの組み合わせは色覚特性のシミュレーション込みで検証済みで、
 * 隣接ペアの最悪値は ΔE 14.3（CVD）/ 17.3（通常視）。
 * 検証したのは開催ステータスの3色（open / cancelled / special）で、
 * これを変えるときは同じ検証をやり直すこと。
 *
 * あわせて、色だけに意味を持たせないための二重符号化を必ず入れる：
 *   - ヒートマップのセルには記号（× ★ －）を重ねる
 *   - 系列が2つ以上あるチャートには必ず凡例を置く
 *   - すべてのチャートに表形式の代替表示（<details>）を添える
 */

/** 文字色。データの色を文字に使わない（読めなくなるため）。 */
export const INK = {
  primary: "#78350f",
  secondary: "#92400e",
  /** 軸ラベル用。白背景でコントラスト比 約5.2:1 */
  muted: "#7a6a58",
} as const;

/** 面と罫。グリッドは実線のヘアラインで、面から1段だけ落とす。 */
export const SURFACE = {
  card: "#ffffff",
  grid: "#f3ead9",
  axis: "#e7d9bf",
  /** データが無いセル */
  empty: "#f5f1e9",
} as const;

/** 量を表す1色のランプ（淡→濃）。ヒートマップ・マトリクスで使う。 */
export const SEQUENTIAL = [
  "#fef3c7",
  "#fde68a",
  "#fcd34d",
  "#fbbf24",
  "#f59e0b",
  "#d97706",
  "#b45309",
] as const;

/** 単一系列の棒・線。 */
export const SERIES = {
  bar: "#d97706",
  /** 移動平均などの補助線 */
  line: "#7c2d12",
  /** 強調しない側（比較対象） */
  muted: "#e7d9bf",
} as const;

/**
 * 歩く向き用のダイバージング。暖色↔寒色で「反対」に読ませる。
 * 地図と同じく west を左、east を右に置く。
 */
export const DIRECTION = {
  west: "#2a78d6",
  east: "#c2410c",
} as const;

/** 開催ステータス。色＋記号の二重符号化が前提。 */
export const MARKET_STATUS = {
  open: { color: "#d97706", glyph: "", label: "開催" },
  cancelled: { color: "#c2334d", glyph: "×", label: "荒天中止" },
  special: { color: "#4a3aa7", glyph: "★", label: "特別開催" },
  closed: { color: "#a89e90", glyph: "－", label: "臨時休市" },
} as const;

export type MarketStatus = keyof typeof MARKET_STATUS;

/** 量を SEQUENTIAL のどの段に落とすか。max が 0 のときは最下段。 */
export function rampStep(value: number, max: number) {
  if (max <= 0 || value <= 0) return SURFACE.empty;
  const ratio = value / max;
  const index = Math.min(
    SEQUENTIAL.length - 1,
    Math.max(0, Math.ceil(ratio * SEQUENTIAL.length) - 1)
  );
  return SEQUENTIAL[index];
}

/** 塗りの明るさに応じて、セル内の文字色を白／墨から選ぶ。 */
export function inkOn(fill: string) {
  const hex = fill.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? "#3A3A3A" : "#ffffff";
}

export function formatPercent(value: number, digits = 1) {
  return `${(Math.round(value * 10 ** (digits + 2)) / 10 ** digits).toFixed(digits)}%`;
}
