/**
 * 屋台の倍率（icon-size）。
 *
 * 写真入りは通常の屋台（60px）より大きい（PHOTO_STALL_PX）。同じ倍率で出すと、引いたとき
 * 店舗間隔（列内 5.9m）に対して大きすぎて、隣の屋台と大きく重なる。
 * そこで「通常の屋台と同じ大きさ」を下限、「店舗間隔に収まる大きさ」を上限にして、
 * 最大ズームに近づくほど本来の大きさ（1.0）に近づける。
 *
 * 最大ズームより先に「写真を大きく見るための一段」（detailOffset）があるときは、
 * そこまでに detailScale 倍へ大きくする。地図の縮尺は 1 段で 2 倍になるので、店舗間隔も 2 倍に広がる。
 *
 * MapLibre では ["zoom"] を interpolate / step の外では使えないので、
 * ズームごとの値を計算して折れ線の stops にする。
 */
import type { ExpressionSpecification } from "maplibre-gl";

export interface PhotoStallScaleInput {
  /** 屋台が本来の大きさ（1.0）になるズーム（MapLibre）。LOD の基準でもある */
  maxZoom: number;
  /** 写真入りの屋台の高さ（px） */
  photoStallPx: number;
  /** 通常の屋台の高さ（px） */
  baseStallPx: number;
  /** maxZoom での店舗間隔（px） */
  spacingPxAtMax: number;
  /** 通常の屋台の倍率が 0.6 になるズーム差（maxZoom 基準、負の値）と、写真入りが出始めるズーム差 */
  stallLodOffset: number;
  photoLodOffset: number;
  /** 店舗間隔のうち屋台が使ってよい割合 */
  spacingFill?: number;
  /** maxZoom より先に寄れる量（ズーム差、正の値）と、そこでの倍率。省略すると maxZoom で頭打ち */
  detailOffset?: number;
  detailScale?: number;
}

/**
 * 通常の屋台の倍率。stallLodOffset で 0.6、maxZoom で 1.0、その先は detailOffset で detailScale の線形補間。
 * offset は maxZoom からのズーム差。
 */
export function stallScaleAt(
  offset: number,
  input: Pick<PhotoStallScaleInput, "stallLodOffset" | "detailOffset" | "detailScale">
): number {
  if (offset > 0) {
    const { detailOffset, detailScale } = input;
    if (!detailOffset || !detailScale) return 1;
    const t = Math.min(1, offset / detailOffset);
    return 1 + (detailScale - 1) * t;
  }
  const t = Math.min(1, Math.max(0, offset / input.stallLodOffset));
  return 1 + (0.6 - 1) * t;
}

export function photoStallScaleAt(offset: number, input: PhotoStallScaleInput): number {
  const { photoStallPx, baseStallPx, spacingPxAtMax, spacingFill = 0.92 } = input;
  const s = stallScaleAt(offset, input);
  const fit = (spacingFill * spacingPxAtMax * 2 ** offset) / photoStallPx;
  const floor = (baseStallPx * s) / photoStallPx;
  return Math.max(floor, Math.min(s, fit));
}

export function buildPhotoStallScale(input: PhotoStallScaleInput): ExpressionSpecification {
  const step = 0.1;
  const stops: number[] = [];
  const from = input.photoLodOffset;
  const to = input.detailOffset && input.detailScale ? input.detailOffset : 0;
  const count = Math.round((to - from) / step);
  for (let i = 0; i <= count; i += 1) {
    const offset = from + i * step;
    stops.push(input.maxZoom + offset, Number(photoStallScaleAt(offset, input).toFixed(4)));
  }
  return ["interpolate", ["linear"], ["zoom"], ...stops] as unknown as ExpressionSpecification;
}
