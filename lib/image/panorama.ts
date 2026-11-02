/**
 * 全周カメラ（360度カメラ）で撮った写真かを、画像の大きさだけで見分ける。
 *
 * 全周写真は正距円筒図法（equirectangular）で、横:縦 = 2:1 に保存される。
 * 店のデータに「360度」の印は持たせず、この比率で判定する。
 * 普通の写真で 2:1 ちょうどになることはまずない（横長の写真も 3:2 や 16:9）。
 * 大きさは問わない。出店者が軽量化した画像（WebP で 1200px 幅など）も、バナーのサムネイル
 * （400px 幅）も、next/image が縮小した後の画像も、2:1 のまま小さくなるだけなので同じ比率で判定できる。
 * 下限は、読み込み前の 0 や極端に小さな画像を除くためだけに置く。
 */
const EQUIRECTANGULAR_RATIO = 2;
const RATIO_TOLERANCE = 0.02;
const MIN_PANORAMA_WIDTH = 64;

export function isEquirectangularPhoto(width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  if (width < MIN_PANORAMA_WIDTH) return false;
  return Math.abs(width / height - EQUIRECTANGULAR_RATIO) <= RATIO_TOLERANCE * EQUIRECTANGULAR_RATIO;
}
