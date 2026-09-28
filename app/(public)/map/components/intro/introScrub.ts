/**
 * にちよさんをつまんで送るときの、指の動き → スクロール位置の対応。
 *
 * 【倍率】
 * 指 1px でどれだけ中身が動くか。道（案内の左の列）の高さで案内全体を一往復
 * できる倍率にして、上下どちらへ引いても同じ手応えにする。以前は上下で倍率を
 * 別々に決めていたが、にちよさんは節の先頭（画面の上のほう）に立っているので
 * 上へ戻す余地が小さく、上向きの倍率だけ跳ね上がって数 px で何画面も飛んでいた。
 * 倍率には上限と下限を置く。
 *
 * 【端で送り続ける】
 * 指が道の上端・下端を越えたら、越えたぶんに応じた速さで中身を送り続ける
 * （並べ替えのドラッグで一覧の端に持っていくと流れていく、あの動き）。
 * にちよさんは端に留まり、道のほうが流れてくる。これで、上のほうに立っている
 * にちよさんを上へ引いても、指を離さずに先頭まで戻れる。
 */

export const DEFAULT_SCRUB_MAX_GAIN = 8;
export const DEFAULT_SCRUB_MIN_GAIN = 1;

/** 端を越えた指 1px あたりの、送る速さ（px/秒） */
export const EDGE_SCROLL_SPEED_PER_PX = 24;
/** 端で送り続けるときの速さの上限（px/秒） */
export const EDGE_SCROLL_MAX_SPEED = 1400;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 道の高さ（にちよさんが動ける範囲）で案内全体を送れる倍率 */
export function scrubGain(
  trackHeight: number,
  maxScroll: number,
  options: { minGain?: number; maxGain?: number } = {}
): number {
  const minGain = options.minGain ?? DEFAULT_SCRUB_MIN_GAIN;
  const maxGain = options.maxGain ?? DEFAULT_SCRUB_MAX_GAIN;
  return clamp(maxScroll / Math.max(1, trackHeight), minGain, maxGain);
}

/**
 * 基準（つまんだ位置、または端で送ったあとの位置）からの指の動きで、
 * 行くべきスクロール位置を返す
 */
export function scrubScrollTop(options: {
  anchorScrollTop: number;
  anchorY: number;
  y: number;
  gain: number;
  maxScroll: number;
}): number {
  const { anchorScrollTop, anchorY, y, gain, maxScroll } = options;
  return clamp(Math.round(anchorScrollTop + (y - anchorY) * gain), 0, maxScroll);
}

/**
 * 指が道の端を越えているときの、送り続ける速さ（px/秒。上へ戻すときは負）。
 * 端の内側なら 0
 */
export function edgeScrollSpeed(y: number, minY: number, maxY: number): number {
  if (y < minY) return -Math.min(EDGE_SCROLL_MAX_SPEED, (minY - y) * EDGE_SCROLL_SPEED_PER_PX);
  if (y > maxY) return Math.min(EDGE_SCROLL_MAX_SPEED, (y - maxY) * EDGE_SCROLL_SPEED_PER_PX);
  return 0;
}

/**
 * いまのスクロール位置がどの停留点の手前まで来ているか（通り過ぎた停留点の番号）。
 * つまんで送っているあいだ、この値が変わるたびに短い振動で手応えを返す
 */
export function passedStopIndex(scrollTop: number, anchorYs: number[]): number {
  let index = 0;
  for (let i = 0; i < anchorYs.length; i += 1) {
    if (anchorYs[i] <= scrollTop) index = i;
  }
  return index;
}
