/**
 * 全周カメラ（360度カメラ）で撮った写真かを、画像の大きさだけで見分ける。
 *
 * 全周写真は正距円筒図法（equirectangular）で、横:縦 = 2:1 に保存される。
 * 店のデータに「360度」の印は持たせず、この比率で判定する。
 * 普通の写真で 2:1 ちょうどになることはまずない（横長の写真も 3:2 や 16:9）。
 * 小さな画像はたまたま 2:1 でも全周とは限らないので、横が一定以上のものだけを対象にする。
 * 判定に使う大きさは next/image が縮小した後のもの（スマホでは 828〜1200px 程度）なので、
 * 下限は deviceSizes の最小値（640）より少し下に置く。
 */
const EQUIRECTANGULAR_RATIO = 2;
const RATIO_TOLERANCE = 0.02;
const MIN_PANORAMA_WIDTH = 600;

export function isEquirectangularPhoto(width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  if (width < MIN_PANORAMA_WIDTH) return false;
  return Math.abs(width / height - EQUIRECTANGULAR_RATIO) <= RATIO_TOLERANCE * EQUIRECTANGULAR_RATIO;
}
