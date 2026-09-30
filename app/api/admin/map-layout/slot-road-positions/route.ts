import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { authorizeAdmin } from "@/app/api/admin/categories/_helpers";
import {
  createAdminWriteClient,
  createMapLayoutSnapshot,
  hasRoadPositionSchema,
  loadEditableRoads,
  loadEditableShops,
  loadRouteConfig,
  planSlotRoadPositions,
  ROAD_POSITION_SCHEMA_MISSING_MESSAGE,
} from "../_shared";

/**
 * 既存の区画に「道基準の位置」を入れる移行処理（マップ編集画面から実行する）。
 *
 * GET: 試算だけを行い、自動で変換できる区画と、どの道にも近くないため変換しない区画の一覧を返す。
 * POST: 試算と同じ計算で変換できる区画に値を入れる。書き込む前にスナップショットを1つ作るので、
 *       問題があれば「変更履歴」から移行前の状態に戻せる。緯度経度は変えない。
 */

async function loadPlan(supabase: ReturnType<typeof createServerClient>) {
  const [shops, roads, routeConfig] = await Promise.all([
    loadEditableShops(supabase),
    loadEditableRoads(supabase),
    loadRouteConfig(supabase),
  ]);
  return { shops, roads, plan: planSlotRoadPositions(shops, roads, routeConfig.snapDistanceMeters) };
}

export async function GET() {
  try {
    const { error: authError } = await authorizeAdmin();
    if (authError) return NextResponse.json({ error: authError }, { status: 403 });

    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const { plan } = await loadPlan(supabase);
    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json({ error: "Failed to plan slot road positions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-map-layout-slot-road-positions",
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const { user, error: authError } = await authorizeAdmin();
    if (authError || !user) return NextResponse.json({ error: authError }, { status: 403 });

    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const adminWriteClient = createAdminWriteClient();

    if (!(await hasRoadPositionSchema(supabase))) {
      return NextResponse.json({ error: ROAD_POSITION_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }

    const { shops, roads, plan } = await loadPlan(supabase);
    if (plan.matched.length === 0) {
      return NextResponse.json({ plan, updatedCount: 0 });
    }

    // 移行前の状態を残す（失敗・想定外のときに「変更履歴」から戻せるように）
    await createMapLayoutSnapshot(
      supabase,
      adminWriteClient,
      user.id,
      { migratedSlotCount: plan.matched.length },
      { shops, roads }
    );

    const { data, error } = await adminWriteClient.rpc("set_market_location_road_positions", {
      p_positions: plan.matched.map((item) => ({
        locationId: item.locationId,
        roadId: item.roadId,
        roadDistanceM: item.roadDistanceM,
        roadSide: item.roadSide,
        roadOffsetM: item.roadOffsetM,
      })),
    });

    if (error) {
      console.error("[admin/map-layout/slot-road-positions] update failed:", error.message);
      return NextResponse.json({ error: "Failed to save slot road positions" }, { status: 500 });
    }

    return NextResponse.json({ plan, updatedCount: typeof data === "number" ? data : plan.matched.length });
  } catch {
    return NextResponse.json({ error: "Failed to save slot road positions" }, { status: 500 });
  }
}
