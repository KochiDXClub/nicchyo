import type { createClient as createServerClient } from "@/utils/supabase/server";
import type { ChomeBoundary, ChomeSection } from "@/lib/map/chomeBoundaries";

/** Postgres の「テーブルが存在しない」エラー */
const UNDEFINED_TABLE = "42P01";

/**
 * 丁目の境目と区間（20261005110000）。マイグレーション前の DB ではテーブルが無いので、空で返す
 * （そのあいだ、画面は丁目の自動判定をせず、従来どおり近くの区画に合わせる）。
 */
export async function loadChomeSettings(supabase: ReturnType<typeof createServerClient>): Promise<{
  boundaries: ChomeBoundary[];
  sections: ChomeSection[];
}> {
  const [boundaries, sections] = await Promise.all([
    supabase
      .from("chome_boundaries")
      .select("id, name, latitude, longitude, confidence")
      .order("sort_order", { ascending: true }),
    supabase.from("chome_sections").select("chome_id, road_id, from_boundary_id, to_boundary_id"),
  ]);
  for (const result of [boundaries, sections]) {
    if (result.error?.code === UNDEFINED_TABLE) return { boundaries: [], sections: [] };
    if (result.error) throw new Error("Failed to load chome settings");
  }
  return {
    boundaries: (boundaries.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      confidence: row.confidence === "needs_review" ? "needs_review" : "confirmed",
    })),
    sections: (sections.data ?? []).map((row) => ({
      chomeId: Number(row.chome_id) as ChomeSection["chomeId"],
      roadId: row.road_id as string,
      fromBoundaryId: (row.from_boundary_id as string | null) ?? null,
      toBoundaryId: (row.to_boundary_id as string | null) ?? null,
    })),
  };
}
