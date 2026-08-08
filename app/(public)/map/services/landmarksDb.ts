import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Landmark } from "../types/landmark";

type LandmarkRow = {
  key: string;
  name: string | null;
  description: string | null;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  width_px: number | null;
  height_px: number | null;
  show_at_min_zoom: boolean | null;
};

export async function fetchLandmarksFromDb(
  supabase: SupabaseClient<Database>
): Promise<Landmark[]> {
  const { data, error } = await supabase
    .from("map_landmarks")
    .select(
      "key, name, description, image_url, latitude, longitude, width_px, height_px, show_at_min_zoom"
    )
    .order("created_at", { ascending: true });

  if (error) {
    // 建物データが取れなくても、店舗など他のマップデータ表示は妨げない
    // （console.error だと Next.js の開発オーバーレイが全画面を覆ってしまうため warn にする）
    console.warn("[fetchLandmarksFromDb] failed:", error.message);
    return [];
  }

  const rows = Array.isArray(data) ? (data as LandmarkRow[]) : [];

  return rows
    .map((row): Landmark | null => {
      if (
        !row.key ||
        !row.name ||
        !row.image_url ||
        row.latitude == null ||
        row.longitude == null ||
        row.width_px == null ||
        row.height_px == null
      ) {
        return null;
      }

      return {
        key: row.key,
        name: row.name,
        description: row.description ?? "",
        url: row.image_url,
        lat: Number(row.latitude),
        lng: Number(row.longitude),
        widthPx: Number(row.width_px),
        heightPx: Number(row.height_px),
        showAtMinZoom: Boolean(row.show_at_min_zoom),
      };
    })
    .filter((row): row is Landmark => row !== null);
}
