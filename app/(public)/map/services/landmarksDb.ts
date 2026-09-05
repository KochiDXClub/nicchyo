import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Landmark, LandmarkCategory, LandmarkTransitMode } from "../types/landmark";

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
  category: string | null;
  transit_mode: string | null;
  lines: string[] | null;
  tags: string[] | null;
  notes: string | null;
  external_url: string | null;
  photo_url: string | null;
  photo_credit: string | null;
  open_from: string | null;
  open_until: string | null;
  show_on_map: boolean | null;
  verified: boolean | null;
};

const CATEGORIES: LandmarkCategory[] = ["transit", "landmark", "restroom", "rest"];

/**
 * category 列の値 → LandmarkCategory。列そのものが無い（マイグレーション未適用で
 * 基本列だけ取れた）ときは undefined を返し、key の規約（"tram-*" 等）で判定させる。
 */
function toCategory(value: string | null | undefined): LandmarkCategory | undefined {
  if (value === undefined) return undefined;
  return CATEGORIES.includes(value as LandmarkCategory) ? (value as LandmarkCategory) : "landmark";
}

function toTransitMode(value: string | null | undefined): LandmarkTransitMode | undefined {
  return value === "tram" || value === "jr" ? value : undefined;
}

const BASE_COLUMNS =
  "key, name, description, image_url, latitude, longitude, width_px, height_px, show_at_min_zoom";
const SPOT_COLUMNS =
  "category, transit_mode, lines, tags, notes, external_url, photo_url, photo_credit, open_from, open_until, show_on_map, verified";

async function selectLandmarkRows(
  supabase: SupabaseClient<Database>,
  columns: string
): Promise<{ rows: Partial<LandmarkRow>[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from("map_landmarks")
    .select(columns)
    .order("created_at", { ascending: true });
  if (error) return { rows: null, error: error.message };
  return { rows: (data ?? []) as unknown as Partial<LandmarkRow>[], error: null };
}

export async function fetchLandmarksFromDb(
  supabase: SupabaseClient<Database>
): Promise<Landmark[]> {
  let result = await selectLandmarkRows(supabase, `${BASE_COLUMNS}, ${SPOT_COLUMNS}`);

  if (result.error) {
    // スポット用の列（20260905123611 のマイグレーション）がまだ無い環境でも
    // 建物・電停の表示が消えないよう、基本列だけで取り直す
    console.warn("[fetchLandmarksFromDb] spot columns unavailable, falling back:", result.error);
    result = await selectLandmarkRows(supabase, BASE_COLUMNS);
  }

  if (result.error || !result.rows) {
    // 建物データが取れなくても、店舗など他のマップデータ表示は妨げない
    // （console.error だと Next.js の開発オーバーレイが全画面を覆ってしまうため warn にする）
    console.warn("[fetchLandmarksFromDb] failed:", result.error);
    return [];
  }

  const data = result.rows;
  const rows = Array.isArray(data) ? (data as unknown as Partial<LandmarkRow>[]) : [];

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
        category: toCategory(row.category),
        transitMode: toTransitMode(row.transit_mode),
        lines: row.lines ?? [],
        tags: row.tags ?? [],
        notes: row.notes ?? undefined,
        externalUrl: row.external_url ?? undefined,
        photoUrl: row.photo_url ?? undefined,
        photoCredit: row.photo_credit ?? undefined,
        openFrom: row.open_from ?? undefined,
        openUntil: row.open_until ?? undefined,
        showOnMap: row.show_on_map ?? true,
        verified: Boolean(row.verified),
      };
    })
    .filter((row): row is Landmark => row !== null);
}
