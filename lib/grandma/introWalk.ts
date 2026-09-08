/**
 * 相談ページで、話し手が入れ替わるときの立ち位置。
 *
 * 前の人は定位置から右の画面外へ歩いて去り、次の人は左の画面外から歩いてきて
 * 定位置で止まる。絵を差し替えるだけだと「別人になった」ことが伝わりにくいが、
 * 出て行って入ってくるなら説明が要らない。
 *
 * 大きさは変えない（定位置と同じ大きさのまま横に動くだけ）。
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

/**
 * 歩き去る先の横位置（定位置からの差、px）を返す。
 *
 * 定位置に置いた絵をこれだけ右へずらすと、絵の左端が画面の右の外に出る。
 */
export function computeWalkOutEndX(
  { left }: IntroRect,
  viewportWidth: number,
  gap = OFFSCREEN_GAP
): number {
  return viewportWidth - left + gap;
}
