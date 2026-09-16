/**
 * マップの表示範囲（動かせる範囲）の設定API（管理者のみ）
 *
 * map_view_settings は公開読み取り・書き込みなし（service role のみ）の
 * テーブルなので、保存はこのルートを通す。認可は requireAdminApi に寄せている。
 *
 * GET は設定に加えて、編集画面が下敷きに描くための道の形（route）と、
 * いまの描画ライブラリ（renderer）も返す。設定が効くのは MapLibre 版だけなので、
 * leaflet のままなら画面に注意書きを出せるようにするため。
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireAdminApi, type AdminApiContext } from "@/lib/auth/requireAdminApi";
import { fetchMapRouteFromDb } from "@/app/(public)/map/services/mapRouteDb";
import {
  getDefaultMapRoutePoints,
  getRouteBounds,
  normalizeMapRoutePoints,
} from "@/app/(public)/map/utils/mapRouteGeometry";
import type { MapRoutePoint } from "@/app/(public)/map/types/mapRoute";
import { normalizeMapFeatureFlags } from "@/lib/mapFeatureFlags";
import { MAP_FLAGS_SETTINGS_KEY } from "@/lib/mapFeatureFlags.server";
import {
  containsRouteBounds,
  isSameMapViewSettings,
  mapViewSettingsFromRow,
  mapViewSettingsToRow,
  resolveMapViewBounds,
  validateMapViewSettingsPatch,
} from "@/lib/map/mapViewSettings";
import { MAP_VIEW_SETTINGS_KEY } from "@/lib/map/mapViewSettings.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE = "map_view_settings";
const COLUMNS = "key, mode, padding_meters, north, south, east, west, min_zoom, updated_at";

export async function GET() {
  try {
    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;

    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);

    const [settingsResult, route, flagsResult] = await Promise.all([
      auth.adminClient.from(TABLE).select(COLUMNS).eq("key", MAP_VIEW_SETTINGS_KEY).maybeSingle(),
      // 道は公開読み取りなので、ログイン中の管理者のクライアントでそのまま読める
      fetchMapRouteFromDb(supabase),
      auth.adminClient.from("system_settings").select("value").eq("key", MAP_FLAGS_SETTINGS_KEY).maybeSingle(),
    ]);

    if (settingsResult.error) {
      return NextResponse.json({ error: "Failed to load map view settings" }, { status: 500 });
    }

    return NextResponse.json({
      settings: mapViewSettingsFromRow(settingsResult.data),
      updatedAt: settingsResult.data?.updated_at ?? null,
      route,
      renderer: normalizeMapFeatureFlags(flagsResult.data?.value).renderer,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load map view settings" }, { status: 500 });
  }
}

/**
 * 「範囲が道を含んでいるか」を見るための道の範囲。
 *
 * fetchMapRouteFromDb は読み取りに失敗してもコードに焼いた道を返すため、
 * 判定用にはそのまま使えない（実際の道と違う道で検証してしまう）。
 * ここでは読み取り失敗を null で区別し、保存を通さないようにする。
 * 点が無い／少ないときに既定の道へ落ちるのは、公開マップ側と同じ扱い。
 */
async function loadRouteBoundsForCheck(
  adminClient: AdminApiContext["adminClient"]
): Promise<[[number, number], [number, number]] | null> {
  const { data, error } = await adminClient
    .from("map_route_points")
    .select("id, latitude, longitude, sort_order, branch_from_id")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[admin/map-view] failed to read route points:", error.message);
    return null;
  }

  const points = normalizeMapRoutePoints(
    (data ?? [])
      .map((row): MapRoutePoint | null => {
        if (!row.id || row.latitude == null || row.longitude == null) return null;
        return {
          id: row.id,
          lat: Number(row.latitude),
          lng: Number(row.longitude),
          order: Number(row.sort_order ?? 0),
          branchFromId: row.branch_from_id ?? null,
        };
      })
      .filter((point): point is MapRoutePoint => point !== null)
  );

  return getRouteBounds(points.length >= 2 ? points : getDefaultMapRoutePoints());
}

export async function PUT(request: NextRequest) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-map-view-put",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const auth = await requireAdminApi();
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => null)) as { settings?: unknown } | null;
    if (!body || typeof body.settings !== "object" || body.settings === null) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // 送られてこなかった項目はいまの値を引き継ぐ。一部だけ送った保存で、
    // 触っていない項目がコード既定値に巻き戻らないようにする
    const currentResult = await auth.adminClient
      .from(TABLE)
      .select(COLUMNS)
      .eq("key", MAP_VIEW_SETTINGS_KEY)
      .maybeSingle();
    if (currentResult.error) {
      return NextResponse.json({ error: "Failed to save map view settings" }, { status: 500 });
    }
    const current = mapViewSettingsFromRow(currentResult.data);

    // 範囲外の値は黙って丸めずに 400 で返す。丸めて 200 を返すと、
    // 送った値と実際に保存された値が食い違ったまま気づけない
    const validation = validateMapViewSettingsPatch(body.settings, current);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }
    const settings = validation.settings;

    // 道の全体が入らない範囲を保存すると、市場の端の店に近づけないマップになる。
    // 画面側でも止めているが、範囲を壊すと来訪者から見て一目で分かる形で
    // 壊れるため、サーバー側でも見る
    const routeBounds = await loadRouteBoundsForCheck(auth.adminClient);
    if (!routeBounds) {
      // 道が読めないと「範囲に収まっているか」を判定できない。
      // 判定できないまま保存を通すと、実際の道を含まない範囲を許してしまう
      return NextResponse.json({ error: "Failed to save map view settings" }, { status: 500 });
    }
    const resolved = resolveMapViewBounds(settings, routeBounds);
    if (!containsRouteBounds(resolved, routeBounds)) {
      return NextResponse.json(
        { error: "表示範囲が道の全体を含んでいません。範囲を広げてください。" },
        { status: 400 }
      );
    }

    // 内容が同じなら書かない。監査ログはこの設定の唯一の記録なので、
    // 値を変えない PUT を繰り返して行を積める口は塞ぐ（ai-models の PUT と同じ）
    if (isSameMapViewSettings(current, settings)) {
      return NextResponse.json({ ok: true, settings, unchanged: true });
    }

    // upsert ではなく update にする。key はマイグレーションが入れた行だけで、
    // API から新しい key の行を作れる必要がない
    const { data: updated, error } = await auth.adminClient
      .from(TABLE)
      .update({ ...mapViewSettingsToRow(settings), updated_by: auth.user.id })
      .eq("key", MAP_VIEW_SETTINGS_KEY)
      .select("key");

    if (error || !updated || updated.length === 0) {
      if (error) console.error("[admin/map-view] update failed:", error.message);
      return NextResponse.json({ error: "Failed to save map view settings" }, { status: 500 });
    }

    // 誰がいつ範囲を変えたかを残す。記録に失敗しても保存は成功させる
    // （監査ログのために設定変更を巻き戻すと、何が効いているのか分からなくなる）
    const { error: auditError } = await auth.adminClient.from("admin_audit_logs").insert({
      actor_id: auth.user.id,
      actor_email: auth.user.email,
      actor_role: auth.role,
      action: "map_view_settings_updated",
      target_type: TABLE,
      target_id: MAP_VIEW_SETTINGS_KEY,
      details: JSON.stringify(settings),
    });
    if (auditError) {
      console.error("[admin/map-view] audit log failed:", auditError.message);
    }

    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ error: "Failed to save map view settings" }, { status: 500 });
  }
}
