// squarified treemap レイアウト。scripts/code-health/report-html.mjs の
// 静的レポート内スクリプト（ブラウザの <script> タグ内、テストできない場所）にあった
// アルゴリズムを、テストできる純粋関数として lib/ に移した。

export interface TreemapInput {
  value: number;
}

export interface TreemapRect<T extends TreemapInput> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** value <= 0 の要素は無視する（面積を持てないため） */
export function squarify<T extends TreemapInput>(
  items: T[],
  x: number,
  y: number,
  w: number,
  h: number
): TreemapRect<T>[] {
  const out: TreemapRect<T>[] = [];
  const positive = items.filter((it) => it.value > 0);
  const total = positive.reduce((s, it) => s + it.value, 0);
  if (total <= 0 || w <= 0 || h <= 0) return out;

  const scale = (w * h) / total;
  const nodes = positive.map((it) => ({ it, area: it.value * scale })).sort((a, b) => b.area - a.area);

  let rx = x;
  let ry = y;
  let rw = w;
  let rh = h;

  const worst = (row: typeof nodes, side: number) => {
    const s = row.reduce((a, n) => a + n.area, 0);
    let max = 0;
    let min = Infinity;
    for (const n of row) {
      max = Math.max(max, n.area);
      min = Math.min(min, n.area);
    }
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };

  const layoutRow = (row: typeof nodes) => {
    const s = row.reduce((a, n) => a + n.area, 0);
    if (rw >= rh) {
      const cw = s / rh;
      let cy = ry;
      for (const n of row) {
        const ch = n.area / cw;
        out.push({ item: n.it, x: rx, y: cy, w: cw, h: ch });
        cy += ch;
      }
      rx += cw;
      rw -= cw;
    } else {
      const ch = s / rw;
      let cx = rx;
      for (const n of row) {
        const cw = n.area / ch;
        out.push({ item: n.it, x: cx, y: ry, w: cw, h: ch });
        cx += cw;
      }
      ry += ch;
      rh -= ch;
    }
  };

  let row: typeof nodes = [];
  for (const n of nodes) {
    const side = Math.min(rw, rh);
    if (row.length === 0 || worst([...row, n], side) <= worst(row, side)) row.push(n);
    else {
      layoutRow(row);
      row = [n];
    }
  }
  if (row.length) layoutRow(row);
  return out;
}

/** 色分けを段階に区切る（コピペ率・ルール違反数のような連続値を色の濃さに変換する） */
export function colorStep(value: number, cuts: number[]): number {
  let i = 0;
  while (i < cuts.length && value > cuts[i]) i += 1;
  return i;
}

export const DUP_RATIO_CUTS = [0, 5, 10, 20, 35, 50];
export const VIOLATION_CUTS = [0, 2, 5, 10, 20, 40];

// 連続値を色の濃さに変換する配色（薄い→濃い）。段階数は cuts.length + 1 に合わせる
export const SEQUENTIAL_PALETTE = ["#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#92400e"];
