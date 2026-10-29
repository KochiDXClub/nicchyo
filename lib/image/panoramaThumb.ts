/**
 * 全周写真から、バナーと地図に出す「普通の写真に近い」サムネイルを切り出す位置の計算。
 *
 * 高さは写真の中央で固定し、左右だけ選べる。切り出す幅は写真の横の4分の1（約90°分）、縦横比は4:3。
 * 全周写真は左右がつながっているので、端をまたぐ位置も選べる（切り出しが2つに分かれる）。
 */

/** 切り出す幅の、写真の横幅に対する割合（約90°分） */
export const PANORAMA_THUMB_WIDTH_RATIO = 0.25;
/** サムネイルの縦横比（横 ÷ 縦） */
export const PANORAMA_THUMB_ASPECT = 4 / 3;
/** サムネイルの横幅の上限。2400px の写真なら、切り出した600pxをそのまま使う */
export const PANORAMA_THUMB_MAX_WIDTH = 800;

export type PanoramaThumbSegment = {
  /** 元の写真から取る範囲の左端と幅 */
  sx: number;
  sw: number;
  /** サムネイル側に置く左端と幅 */
  dx: number;
  dw: number;
};

export type PanoramaThumbGeometry = {
  /** 元の写真から取る範囲の上端と高さ（どの切り出しでも共通） */
  sy: number;
  sh: number;
  /** サムネイルの大きさ */
  outWidth: number;
  outHeight: number;
  /** 端をまたがなければ 1 つ、またげば 2 つ */
  segments: PanoramaThumbSegment[];
};

/** 0〜1（左端〜右端）に収める。端をこえた値は反対側へ回す。数でなければ中央 */
export function normalizePanoramaCenter(center: number): number {
  if (!Number.isFinite(center)) return 0.5;
  return ((center % 1) + 1) % 1;
}

/**
 * @param width 元の写真の横幅
 * @param height 元の写真の縦
 * @param center 切り出しの中心。横幅に対する割合（0〜1）
 */
export function panoramaThumbGeometry(width: number, height: number, center: number): PanoramaThumbGeometry {
  const cropWidth = Math.max(1, Math.round(width * PANORAMA_THUMB_WIDTH_RATIO));
  const cropHeight = Math.max(1, Math.min(height, Math.round(cropWidth / PANORAMA_THUMB_ASPECT)));
  const sy = Math.round((height - cropHeight) / 2);

  const outWidth = Math.min(cropWidth, PANORAMA_THUMB_MAX_WIDTH);
  const outHeight = Math.max(1, Math.round((outWidth * cropHeight) / cropWidth));

  const left = Math.round(normalizePanoramaCenter(center) * width - cropWidth / 2);
  const sx = ((left % width) + width) % width;

  const firstWidth = Math.min(cropWidth, width - sx);
  const firstOut = Math.round((firstWidth * outWidth) / cropWidth);
  const segments: PanoramaThumbSegment[] = [{ sx, sw: firstWidth, dx: 0, dw: firstOut }];
  if (firstWidth < cropWidth) {
    segments.push({ sx: 0, sw: cropWidth - firstWidth, dx: firstOut, dw: outWidth - firstOut });
  }
  return { sy, sh: cropHeight, outWidth, outHeight, segments };
}
