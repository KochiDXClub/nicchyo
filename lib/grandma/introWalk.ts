/**
 * 相談ページの入りで、にちよさんが画面の外から歩いてくるときの位置。
 *
 * 大きさは変えない。定位置と同じ大きさのまま、画面の左の外から歩いてきて
 * 定位置で止まる。大きさが変わる動きは「なぜ縮んだのか」の説明が要るが、
 * 歩いてくる動きは説明が要らない。
 *
 * 表示側の都合を持ち込まない純関数にしてある。
 */

export interface IntroRect {
  /** 定位置の左端（ビューポート基準） */
  left: number;
  width: number;
}

/** 歩き始める前に、画面の外へどれだけ余分に逃がすか（影のぶん） */
const OFFSCREEN_GAP = 24;

/**
 * 歩き始めの横位置（定位置からの差、px）を返す。
 *
 * 定位置に置いた絵をこれだけ左へずらすと、絵の右端が画面の左の外に出る。
 * ここから 0 へ動かせば「画面の外から歩いてきて定位置で止まる」になる。
 */
export function computeWalkInStartX({ left, width }: IntroRect, gap = OFFSCREEN_GAP): number {
  return -(left + width + gap);
}
