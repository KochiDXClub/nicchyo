/**
 * にちよさんをつまんで送るときの、指の位置 → スクロール位置の対応。
 *
 * つまんだ瞬間の位置をそのまま「いまのスクロール位置」に結び、
 * 道（案内の左の列）の下端まで引けば案内の最後、上端まで戻せば先頭、になるよう
 * 上下それぞれで倍率を決める。つまんだ瞬間に中身が跳ねず、しかも
 * 「下まで引けば最後まで行く」がいつも成り立つ。
 *
 * 倍率には上限を置く。上端のすぐそばでつまんで上へ戻すときなど、残りの
 * 指の余地に対して残りのスクロールが大きすぎると、数 px で何画面も飛んで
 * 制御できなくなるため。上限に掛かったときは一度の引きで端まで届かないが、
 * つまみ直せばよい。
 */

export type ScrubMappingOptions = {
  /** つまんだときの指（にちよさんの上端）の位置。画面上の px */
  grabY: number;
  /** つまんだときのスクロール位置 */
  grabScrollTop: number;
  /** にちよさんの上端が動ける範囲（画面上の px）。道の上端と、下端から絵の高さを引いた位置 */
  minY: number;
  maxY: number;
  /** スクロールできる最大値 */
  maxScroll: number;
  /** 指 1px あたり中身が動く最大 px */
  maxGain?: number;
};

export const DEFAULT_SCRUB_MAX_GAIN = 8;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 指の位置（画面上の px）からスクロール位置を返す関数を作る */
export function createScrubMapping(options: ScrubMappingOptions): (y: number) => number {
  const { grabY, grabScrollTop, minY, maxY, maxScroll } = options;
  const maxGain = options.maxGain ?? DEFAULT_SCRUB_MAX_GAIN;
  const downRoom = Math.max(1, maxY - grabY);
  const upRoom = Math.max(1, grabY - minY);
  const downGain = Math.min(maxGain, Math.max(0, maxScroll - grabScrollTop) / downRoom);
  const upGain = Math.min(maxGain, Math.max(0, grabScrollTop) / upRoom);
  return (y: number) => {
    const clampedY = clamp(y, minY, maxY);
    const delta = clampedY - grabY;
    const scrollTop = delta >= 0 ? grabScrollTop + delta * downGain : grabScrollTop + delta * upGain;
    return clamp(Math.round(scrollTop), 0, maxScroll);
  };
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
