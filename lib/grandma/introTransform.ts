/**
 * 相談ページの入りの動き（大きいにちよさん → 定位置）の計算。
 *
 * 画面いっぱいに出した絵を、実際に落ち着く場所（ページ内のにちよさん）へ
 * 重ねるための transform を出す。位置と大きさを width/height ではなく
 * transform で動かすのは、途中でレイアウトを走らせないため
 * （走らせると下の本文まで毎フレーム動いてガタつく）。
 *
 * 表示側の都合を持ち込まない純関数にしてある。
 */

export interface IntroRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface IntroTransform {
  /** 中心をどれだけ動かすか（px） */
  dx: number;
  dy: number;
  /** 縮小率。1 未満になる */
  scale: number;
}

/**
 * from（大きい絵）の中心と大きさを、to（定位置）へ合わせる transform を返す。
 *
 * transform-origin は中心（既定値）を前提にしている。
 * `translate(dx, dy) scale(scale)` の順で当てること。translate が先なら
 * 移動量は scale の影響を受けないので、この計算がそのまま使える。
 *
 * 大きさが取れないとき（描画前など）は動かさない値を返し、
 * 呼び出し側が「演出を諦めてそのまま出す」判断をできるようにする。
 */
export function computeIntroTransform(from: IntroRect, to: IntroRect): IntroTransform {
  if (!(from.width > 0) || !(to.width > 0)) {
    return { dx: 0, dy: 0, scale: 1 };
  }

  return {
    dx: to.left + to.width / 2 - (from.left + from.width / 2),
    dy: to.top + to.height / 2 - (from.top + from.height / 2),
    scale: to.width / from.width,
  };
}

/** computeIntroTransform の結果を CSS の transform 文字列にする */
export function toTransformStyle({ dx, dy, scale }: IntroTransform): string {
  return `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${scale.toFixed(4)})`;
}
