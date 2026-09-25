import type { Landmark } from "../types/landmark";
import optimizedLandmarkImages from "../data/optimizedLandmarkImages.json";

const OPTIMIZED: Readonly<Record<string, string>> = optimizedLandmarkImages;

/**
 * 建物画像の URL を、表示サイズに合わせた軽量版（WebP）に差し替える。
 *
 * DB（map_landmarks.image_url）は元の PNG を指したまま。管理画面はその値を読んで
 * 保存し直すので、DB 側は書き換えず、地図に渡す直前でだけ差し替える。
 * 軽量版は scripts/build-landmark-images.mjs が作る。対応表に無い URL はそのまま返す。
 */
export function withOptimizedLandmarkImage(landmark: Landmark): Landmark {
  const optimized = OPTIMIZED[landmark.url];
  return optimized ? { ...landmark, url: optimized } : landmark;
}
