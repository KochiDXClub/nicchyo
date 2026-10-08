import type { Landmark } from "../types/landmark";

const BUILDINGS_DIR = "/images/maps/elements/buildings/";

/**
 * 建物画像の URL が古い PNG のままなら、WebP に差し替える。
 *
 * 建物の画像は WebP だけを置いている（PNG は削除済み）。DB（map_landmarks.image_url）は
 * マイグレーションで .webp に更新するが、デプロイとマイグレーションの順番が前後しても
 * 地図の建物が消えないよう、地図に渡す直前に .png を .webp に読み替える。
 */
export function withOptimizedLandmarkImage(landmark: Landmark): Landmark {
  if (!landmark.url.startsWith(BUILDINGS_DIR) || !landmark.url.endsWith(".png")) {
    return landmark;
  }
  return { ...landmark, url: landmark.url.replace(/\.png$/, ".webp") };
}
