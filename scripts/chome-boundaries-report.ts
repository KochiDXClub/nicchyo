/**
 * 丁目の境目の確認レポート（読み取り専用。DB は書き換えない）。
 *
 *   1. 境目の座標を道に投影した結果（道ID・始点からの距離・ずれ）。ずれが 15m を超えるものに印を付ける
 *   2. すべての区画に丁目の自動判定を実行し、今の丁目と食い違うもの・要確認のものを一覧にする
 *      （手で設定した区画 chome_locked は、自動判定の対象にしない）
 *
 * 使い方（接続先は .env.local の NEXT_PUBLIC_SUPABASE_URL。本番に向けるときは自分で環境変数を渡す）:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/chome-boundaries-report.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  buildChomeRanges,
  CHOME_PROJECTION_WARN_M,
  judgeChome,
  type ChomeBoundary,
  type ChomeSection,
} from "../lib/map/chomeBoundaries";
import type { ChomeId } from "../lib/map/chomes";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を環境変数に渡してください");
  process.exit(1);
}
console.log(`接続先: ${new URL(url).host}`);
const db = createClient(url, key, { auth: { persistSession: false } });

async function load<T>(table: string, columns: string): Promise<T[]> {
  const { data, error } = await db.from(table).select(columns);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as T[];
}

async function main() {
  const [boundaryRows, sectionRows, pointRows, locations] = await Promise.all([
    load<{ id: string; name: string; latitude: number; longitude: number; confidence: ChomeBoundary["confidence"] }>(
      "chome_boundaries",
      "id, name, latitude, longitude, confidence"
    ),
    load<{ chome_id: number; road_id: string; from_boundary_id: string | null; to_boundary_id: string | null }>(
      "chome_sections",
      "chome_id, road_id, from_boundary_id, to_boundary_id"
    ),
    load<{ road_id: string | null; latitude: number; longitude: number; sort_order: number }>(
      "map_route_points",
      "road_id, latitude, longitude, sort_order"
    ),
    load<{
      store_number: number;
      district: string | null;
      chome_id: number | null;
      chome_locked: boolean;
      road_id: string | null;
      road_distance_m: number | null;
    }>("market_locations", "store_number, district, chome_id, chome_locked, road_id, road_distance_m"),
  ]);

  const boundaries: ChomeBoundary[] = boundaryRows.map((b) => ({
    id: b.id,
    name: b.name,
    lat: b.latitude,
    lng: b.longitude,
    confidence: b.confidence,
  }));
  const sections: ChomeSection[] = sectionRows.map((s) => ({
    chomeId: s.chome_id as ChomeId,
    roadId: s.road_id,
    fromBoundaryId: s.from_boundary_id,
    toBoundaryId: s.to_boundary_id,
  }));
  const roads = new Map<string, { lat: number; lng: number }[]>();
  for (const p of [...pointRows].sort((a, b) => a.sort_order - b.sort_order)) {
    if (!p.road_id) continue;
    roads.set(p.road_id, [...(roads.get(p.road_id) ?? []), { lat: p.latitude, lng: p.longitude }]);
  }

  const { ranges, projections, problems } = buildChomeRanges(roads, boundaries, sections);

  console.log("\n## 境目を道に投影した結果");
  console.log("道ID\t境目\t始点からの距離(m)\tずれ(m)\t確かさ");
  for (const p of projections) {
    const b = boundaries.find((x) => x.id === p.boundaryId)!;
    const flag = p.offsetM > CHOME_PROJECTION_WARN_M ? `  ⚠ ${CHOME_PROJECTION_WARN_M}m超` : "";
    console.log(
      `${p.roadId}\t${b.id} ${b.name}\t${p.distanceM.toFixed(1)}\t${p.offsetM.toFixed(1)}${flag}\t${b.confidence === "needs_review" ? "要確認" : "確定"}`
    );
  }
  console.log("\n## 丁目ごとの区間");
  for (const r of [...ranges].sort((a, b) => a.chomeId - b.chomeId)) {
    console.log(`${r.chomeId}丁目\t${r.roadId}\t${r.startM.toFixed(1)}〜${r.endM.toFixed(1)}m`);
  }
  if (problems.length > 0) console.log("\n## 問題\n" + problems.map((p) => `- ${p}`).join("\n"));

  console.log("\n## 区画の自動判定");
  const mismatches: string[] = [];
  const reviews: string[] = [];
  let judged = 0;
  let skipped = 0;
  for (const loc of locations) {
    if (loc.chome_locked) continue;
    if (!loc.road_id || loc.road_distance_m == null) {
      skipped += 1;
      continue;
    }
    judged += 1;
    const j = judgeChome(ranges, projections, { roadId: loc.road_id, distanceM: loc.road_distance_m });
    const label = `店番 ${loc.store_number}（今: ${loc.district ?? "未設定"}）`;
    if (j.status === "ok") {
      if (j.chomeId !== loc.chome_id) mismatches.push(`${label} → 自動判定 ${j.chomeId}丁目`);
    } else {
      reviews.push(`${label} → ${j.status}${"candidates" in j ? ` 候補 ${j.candidates.join("・")}丁目` : ""}`);
    }
  }
  console.log(`判定した区画 ${judged} 件、道基準の位置がなく対象外 ${skipped} 件、手で設定済み（対象外）${locations.filter((l) => l.chome_locked).length} 件`);
  console.log(`\n### 今の丁目と食い違う区画（${mismatches.length} 件）`);
  mismatches.forEach((m) => console.log(`- ${m}`));
  console.log(`\n### 要確認・対象外（${reviews.length} 件）`);
  reviews.forEach((m) => console.log(`- ${m}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
