import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchLandmarksFromDb } from "@/app/(public)/map/services/landmarksDb";
import { fetchMapRouteFromDb } from "@/app/(public)/map/services/mapRouteDb";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole, isAdmin } from "@/lib/auth/permissions";
import type { Landmark as EditableLandmark } from "@/app/(public)/map/types/landmark";
import type { MapRoad, MapRouteConfig, MapRoutePoint } from "@/app/(public)/map/types/mapRoute";
import {
  createAdminWriteClient,
  createMapLayoutSnapshot,
  findRoadIdsWithShops,
  loadEditableRoads,
  loadEditableShops,
  loadMapSettingsLimits,
  type EditableRoad,
  type EditableShop,
} from "./_shared";

type VendorOption = {
  id: string;
  name: string;
};

/**
 * 「このPUTリクエストの保存が完了した後に存在するはずの区画一覧」を作る。
 * DBから読み直しただけの状態ではなく、同一リクエスト内の位置更新・新規登録・削除を
 * 反映する必要がある箇所（道削除バリデーション／未割当マーカー数の上限チェック）で
 * 共通して使う（別々に組み立てると、片方だけ修正漏れが起きて2つのチェックが
 * 異なる「保存後の状態」を見てしまう恐れがあるため）。
 */
function computeShopsAfterRequest(
  currentShops: EditableShop[],
  shopsUpdate: { updated?: EditableShop[]; deletedLocationIds?: string[] }
): EditableShop[] {
  const updated = shopsUpdate.updated ?? [];
  const deletedLocationIdSet = new Set(shopsUpdate.deletedLocationIds ?? []);
  const updatedByLocationId = new Map(
    updated.filter((shop) => !shop.locationId.startsWith("new-")).map((shop) => [shop.locationId, shop])
  );
  const newShops = updated.filter((shop) => shop.locationId.startsWith("new-"));

  return currentShops
    .filter((shop) => !deletedLocationIdSet.has(shop.locationId))
    .map((shop) => updatedByLocationId.get(shop.locationId) ?? shop)
    .concat(newShops);
}

function validateShopAssignments(shops: EditableShop[]) {
  const vendorByPosition = new Map<number, string>();
  const positionByVendor = new Map<string, number>();

  for (const shop of shops) {
    const vendorId = shop.vendorId?.trim();
    if (!vendorId) continue;

    const existingVendor = vendorByPosition.get(shop.position);
    if (existingVendor && existingVendor !== vendorId) {
      return `店番 ${shop.position} に複数の店舗を配置できません`;
    }
    vendorByPosition.set(shop.position, vendorId);

    const existingPosition = positionByVendor.get(vendorId);
    if (existingPosition != null && existingPosition !== shop.position) {
      return "同じ店舗を複数の店番に配置できません";
    }
    positionByVendor.set(vendorId, shop.position);
  }

  return null;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdmin(getRole(user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [editableShops, landmarks, mapRoute, roads, vendorsResult, mapSettingsLimits] = await Promise.all([
      loadEditableShops(supabase),
      fetchLandmarksFromDb(supabase),
      fetchMapRouteFromDb(supabase),
      loadEditableRoads(supabase),
      supabase.from("vendors").select("id, shop_name").order("shop_name", { ascending: true }),
      loadMapSettingsLimits(supabase),
    ]);

    if (vendorsResult.error) {
      return NextResponse.json({ error: "Failed to load vendor options" }, { status: 500 });
    }

    const vendors: VendorOption[] = (vendorsResult.data ?? []).map((row) => ({
      id: row.id as string,
      name: ((row.shop_name as string | null) || "名称未設定").trim(),
    }));

    return NextResponse.json({ shops: editableShops, landmarks, route: mapRoute, roads, vendors, mapSettingsLimits });
  } catch {
    return NextResponse.json({ error: "Failed to load map layout" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-map-layout-put",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const adminWriteClient = createAdminWriteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdmin(getRole(user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      shops?: {
        updated?: EditableShop[];
        deletedLocationIds?: string[];
      };
      landmarks?: {
        upsert?: EditableLandmark[];
        deletedKeys?: string[];
      };
      route?: {
        points?: MapRoutePoint[];
        config?: MapRouteConfig;
      };
      // 道の一覧全体（フル置換）。未指定の場合は道を一切変更しない
      // （新エディタが導入されるまでの後方互換）
      roads?: MapRoad[];
    };

    if (
      !body.shops ||
      !body.landmarks ||
      !body.route ||
      !Array.isArray(body.shops.updated) ||
      !Array.isArray(body.shops.deletedLocationIds) ||
      !Array.isArray(body.landmarks.upsert) ||
      !Array.isArray(body.landmarks.deletedKeys) ||
      !Array.isArray(body.route.points) ||
      !body.route.config ||
      (body.roads !== undefined && !Array.isArray(body.roads))
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const assignmentValidationError = validateShopAssignments(body.shops.updated);
    if (assignmentValidationError) {
      return NextResponse.json({ error: assignmentValidationError }, { status: 400 });
    }

    // save_roads_and_points RPCはpointsを常に全削除→再挿入するため、道が残るはずの保存で
    // route.pointsが空配列だと道の形状が丸ごと消える。全道削除時（body.roads===[]）のみ許容し、
    // それ以外で空配列が来た場合は不完全なリクエストとみなして拒否する
    if (body.route.points.length === 0 && (body.roads === undefined || body.roads.length > 0)) {
      return NextResponse.json({ error: "道の経路データが空です。保存を中止しました。" }, { status: 400 });
    }

    // 道削除バリデーション・hasChanges判定・スナップショット作成のすべてが
    // 「保存前の状態」を必要とするため、1回だけ読み込んで使い回す
    const [currentShops, currentRoads, mapSettingsLimits] = await Promise.all([
      loadEditableShops(supabase),
      loadEditableRoads(supabase),
      loadMapSettingsLimits(supabase),
    ]);

    // 区画が乗っている道は削除できない（クライアント側の制約とサーバー側でも二重に検証）
    let removedRoadIds: string[] = [];
    if (body.roads) {
      const nextRoadIds = new Set(body.roads.map((road) => road.id));
      const roadsToRemove = currentRoads.filter((road) => !nextRoadIds.has(road.id));

      if (roadsToRemove.length > 0) {
        // DBから読み直しただけの状態ではなく、同一リクエスト内の位置更新・新規登録・削除を
        // 反映した「この保存が完了した後に存在するはずの区画一覧」で検証する
        // （そうしないと、直前に道へ移動した区画を見落としてその道の削除を誤って許可してしまう）
        const shopsAfterThisRequest = computeShopsAfterRequest(currentShops, body.shops);

        // 道の形状も「保存前（DB）」ではなく「このリクエストで保存される形状」で判定する。
        // 削除される道自体は body.roads に含まれないため保存前の形状のままでよいが、
        // 残る道は body.route.points 側の新しい座標を使わないと、道の点をドラッグしつつ
        // 同じ保存操作で別の道を削除しようとした際に、古い（移動前の）座標のまま
        // 「区画が乗っている」と誤判定してしまう恐れがある
        const bodyPointsByRoadId = new Map<string, MapRoutePoint[]>();
        for (const point of body.route.points) {
          if (!point.roadId) continue;
          const list = bodyPointsByRoadId.get(point.roadId) ?? [];
          list.push(point);
          bodyPointsByRoadId.set(point.roadId, list);
        }
        const roadsForDistanceCheck: EditableRoad[] = [
          ...roadsToRemove,
          ...body.roads.map((road) => ({
            ...road,
            points: bodyPointsByRoadId.get(road.id) ?? [],
          })),
        ];

        const snapDistanceMeters = body.route.config.snapDistanceMeters ?? 18;
        const roadIdsWithShops = findRoadIdsWithShops(shopsAfterThisRequest, roadsForDistanceCheck, snapDistanceMeters);

        for (const road of roadsToRemove) {
          if (roadIdsWithShops.has(road.id)) {
            return NextResponse.json(
              { error: `${road.name || "選択した道"} には区画があるため削除できません` },
              { status: 400 }
            );
          }
        }
      }

      removedRoadIds = roadsToRemove.map((road) => road.id);
    }

    // 建物・未割当区画マーカーの上限（/admin/settings で設定）をサーバー側でも検証する
    // （旧エディタはクライアント側のみのチェックだったため、新エディタでは併せて強制する）
    const currentLandmarks = await fetchLandmarksFromDb(supabase);
    const currentLandmarkKeys = new Set(currentLandmarks.map((l) => l.key));
    const deletedLandmarkKeySet = new Set(body.landmarks.deletedKeys);
    const remainingLandmarkCount = currentLandmarks.filter((l) => !deletedLandmarkKeySet.has(l.key)).length;
    // upsert のうちDBにまだ存在しないkeyだけを「新規追加」として数える
    // （既存の建物の名称編集などを新規追加と誤って二重カウントしないため）
    const newlyAddedLandmarkCount = body.landmarks.upsert.filter((l) => !currentLandmarkKeys.has(l.key)).length;
    const nextLandmarkCount = remainingLandmarkCount + newlyAddedLandmarkCount;
    if (nextLandmarkCount > mapSettingsLimits.maxLandmarks) {
      return NextResponse.json(
        { error: `建物オブジェクトは最大 ${mapSettingsLimits.maxLandmarks} 件までです。` },
        { status: 400 }
      );
    }

    const shopsAfterSaveForCap = computeShopsAfterRequest(currentShops, body.shops);
    const nextUnassignedCount = shopsAfterSaveForCap.filter((s) => !s.vendorId).length;
    if (nextUnassignedCount > mapSettingsLimits.maxUnassignedShopMarkers) {
      return NextResponse.json(
        { error: `未割当マーカは最大 ${mapSettingsLimits.maxUnassignedShopMarkers} 件までです。` },
        { status: 400 }
      );
    }

    // hasChanges はクライアントが送ってきた配列の有無ではなく、実際にDBの現在値と
    // 異なるかどうかで判定する（route.points/roadsは常に全件送られてくるため、
    // 単に「配列が空でない」を条件にすると保存の度に必ずtrueになってしまう）
    const normalizeRoadForCompare = (r: { id: string; name: string; kind: string; widthMeters: number }) =>
      `${r.id}|${r.name}|${r.kind}|${r.widthMeters}`;
    const roadsChanged = body.roads
      ? JSON.stringify(currentRoads.map(({ points: _points, ...r }) => normalizeRoadForCompare(r)).sort()) !==
        JSON.stringify(body.roads.map(normalizeRoadForCompare).sort())
      : false;

    const normalizePointForCompare = (p: {
      id: string;
      lat: number;
      lng: number;
      roadId?: string | null;
      branchFromId?: string | null;
    }) => `${p.id}|${p.lat}|${p.lng}|${p.roadId ?? ""}|${p.branchFromId ?? ""}`;
    const routePointsChanged =
      JSON.stringify(currentRoads.flatMap((r) => r.points).map(normalizePointForCompare).sort()) !==
      JSON.stringify(body.route.points.map(normalizePointForCompare).sort());

    const hasChanges =
      body.shops.updated.length > 0 ||
      body.shops.deletedLocationIds.length > 0 ||
      body.landmarks.upsert.length > 0 ||
      body.landmarks.deletedKeys.length > 0 ||
      routePointsChanged ||
      roadsChanged;

    if (hasChanges) {
      await createMapLayoutSnapshot(
        supabase,
        adminWriteClient,
        user.id,
        {
          updatedShopCount: body.shops.updated.length,
          deletedShopCount: body.shops.deletedLocationIds.length,
          upsertLandmarkCount: body.landmarks.upsert.length,
          deletedLandmarkCount: body.landmarks.deletedKeys.length,
          updatedRoutePointCount: body.route.points.length,
          routeConfigChanged: Boolean(body.route.config),
          updatedRoadCount: body.roads?.length,
          deletedRoadCount: removedRoadIds.length || undefined,
        },
        { shops: currentShops, roads: currentRoads }
      );
    }

    if (body.shops.updated.length > 0) {
      const createdShops = body.shops.updated.filter((shop) => shop.locationId.startsWith("new-"));
      const existingShops = body.shops.updated.filter((shop) => !shop.locationId.startsWith("new-"));

      if (existingShops.length > 0) {
        const { error } = await adminWriteClient
          .from("market_locations")
          .upsert(
            existingShops.map((shop) => ({
              id: shop.locationId,
              latitude: shop.lat,
              longitude: shop.lng,
              store_number: shop.position,
            })),
            { onConflict: "id" }
          );

        if (error) {
          return NextResponse.json({ error: "Failed to update shop locations" }, { status: 500 });
        }
      }

      const createdLocationIdByPosition = new Map<number, string>();
      if (createdShops.length > 0) {
        const { data, error } = await adminWriteClient
          .from("market_locations")
          .insert(
            createdShops.map((shop) => ({
              latitude: shop.lat,
              longitude: shop.lng,
              store_number: shop.position,
            }))
          )
          .select("id, store_number");

        if (error) {
          return NextResponse.json({ error: "Failed to create shop locations" }, { status: 500 });
        }

        for (const row of data ?? []) {
          if (row.id && row.store_number != null) {
            createdLocationIdByPosition.set(Number(row.store_number), row.id as string);
          }
        }
      }

      const assignmentTargets = body.shops.updated.map((shop) => ({
        ...shop,
        locationId: shop.locationId.startsWith("new-")
          ? createdLocationIdByPosition.get(shop.position) ?? shop.locationId
          : shop.locationId,
      }));

      const affectedLocationIds = assignmentTargets
        .map((shop) => shop.locationId)
        .filter((locationId) => !locationId.startsWith("new-"));
      const affectedVendorIds = assignmentTargets
        .map((shop) => shop.vendorId)
        .filter((vendorId): vendorId is string => Boolean(vendorId));

      if (affectedLocationIds.length > 0) {
        const { error } = await adminWriteClient
          .from("location_assignments")
          .delete()
          .in("location_id", affectedLocationIds);

        if (error) {
          return NextResponse.json({ error: "Failed to clear location assignments" }, { status: 500 });
        }
      }

      if (affectedVendorIds.length > 0) {
        const { error } = await adminWriteClient
          .from("location_assignments")
          .delete()
          .in("vendor_id", affectedVendorIds);

        if (error) {
          return NextResponse.json({ error: "Failed to clear vendor assignments" }, { status: 500 });
        }
      }

      const assignmentsToInsert = assignmentTargets
        .filter((shop) => shop.vendorId && !shop.locationId.startsWith("new-"))
        .map((shop) => ({
          location_id: shop.locationId,
          vendor_id: shop.vendorId as string,
          market_date: new Date().toISOString().slice(0, 10),
        }));

      if (assignmentsToInsert.length > 0) {
        const { error } = await adminWriteClient.from("location_assignments").insert(assignmentsToInsert);

        if (error) {
          return NextResponse.json({ error: "Failed to save shop assignments" }, { status: 500 });
        }
      }
    }

    if (body.shops.deletedLocationIds.length > 0) {
      const { error } = await adminWriteClient
        .from("market_locations")
        .delete()
        .in("id", body.shops.deletedLocationIds);

      if (error) {
        return NextResponse.json({ error: "Failed to delete shop locations" }, { status: 500 });
      }
    }

    if (body.landmarks.deletedKeys.length > 0) {
      const { error } = await adminWriteClient
        .from("map_landmarks")
        .delete()
        .in("key", body.landmarks.deletedKeys);

      if (error) {
        return NextResponse.json({ error: "Failed to delete landmarks" }, { status: 500 });
      }
    }

    if (body.landmarks.upsert.length > 0) {
      const { error: landmarksError } = await adminWriteClient.from("map_landmarks").upsert(
        body.landmarks.upsert.map((landmark) => ({
          key: landmark.key,
          name: landmark.name,
          description: landmark.description,
          image_url: landmark.url,
          latitude: landmark.lat,
          longitude: landmark.lng,
          width_px: landmark.widthPx,
          height_px: landmark.heightPx,
          show_at_min_zoom: landmark.showAtMinZoom,
        })),
        { onConflict: "key" }
      );

      if (landmarksError) {
        return NextResponse.json({ error: "Failed to save landmarks" }, { status: 500 });
      }
    }

    // 道（map_roads）のupsert・route_pointsの全置換・除外された道の削除を
    // save_roads_and_points RPCで1トランザクションにまとめて実行する
    // （別々のクエリだと、途中で失敗した場合にmap_roadsとmap_route_pointsが
    // 不整合な状態のままDBに残ってしまうため）
    const routePointsPayload = body.route.points.map((point, index) => ({
      id: point.id,
      latitude: point.lat,
      longitude: point.lng,
      sort_order: index,
      branch_from_id: point.branchFromId ?? null,
      road_id: point.roadId ?? null,
    }));

    const { error: saveRoadsError } = await adminWriteClient.rpc("save_roads_and_points", {
      p_roads: (body.roads ?? []).map((road) => ({
        id: road.id,
        name: road.name,
        kind: road.kind,
        widthMeters: road.widthMeters,
      })),
      p_points: routePointsPayload,
      p_removed_road_ids: removedRoadIds,
    });

    if (saveRoadsError) {
      return NextResponse.json({ error: "Failed to save roads" }, { status: 500 });
    }

    const { error: routeConfigError } = await adminWriteClient.from("map_route_configs").upsert(
      {
        key: body.route.config.key,
        road_half_width_meters: body.route.config.roadHalfWidthMeters,
        snap_distance_meters: body.route.config.snapDistanceMeters,
        visible_distance_meters: body.route.config.visibleDistanceMeters,
      },
      { onConflict: "key" }
    );

    if (routeConfigError) {
      return NextResponse.json({ error: "Failed to save route config" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save map layout" }, { status: 500 });
  }
}
