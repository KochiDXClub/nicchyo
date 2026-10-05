import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchLandmarksFromDb } from "@/app/(public)/map/services/landmarksDb";
import { fetchMapRouteFromDb } from "@/app/(public)/map/services/mapRouteDb";
import { revalidatePublicShops } from "@/app/(public)/map/services/shopCache";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { authorizeAdmin } from "@/app/api/admin/categories/_helpers";
import type { Landmark as EditableLandmark } from "@/app/(public)/map/types/landmark";
import type { MapRoad, MapRouteConfig, MapRoutePoint } from "@/app/(public)/map/types/mapRoute";
import { resolveSlotPositions } from "@/lib/map/roadSlotPosition";
import { MAX_SHOP_ID, MIN_SHOP_ID } from "@/lib/shops/route";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { getRole } from "@/lib/auth/permissions";
import { NEW_VENDOR_ID_PREFIX } from "@/app/(public)/map/types/editableShop";
import {
  createAdminWriteClient,
  createMapLayoutSnapshot,
  findRoadIdsWithShops,
  isRouteConfigChanged,
  loadEditableRoads,
  loadEditableShops,
  loadEditableVendors,
  loadMapSettingsLimits,
  loadRouteConfig,
  loadVendorCategories,
  validateVendorDrafts,
  type EditableRoad,
  type EditableShop,
  type EditableVendor,
} from "./_shared";

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

/** 区画の店番と道基準の位置が正しい形か（DB の制約に当たる前に、分かる言葉で返すため） */
function validateShopFields(shops: EditableShop[]) {
  for (const shop of shops) {
    if (!Number.isInteger(shop.position) || shop.position < MIN_SHOP_ID || shop.position > MAX_SHOP_ID) {
      return `店番は ${MIN_SHOP_ID}〜${MAX_SHOP_ID} の整数にしてください（${shop.position}）`;
    }
    const roadFields = [shop.roadId, shop.roadDistanceM, shop.roadSide, shop.roadOffsetM];
    const filled = roadFields.filter((value) => value !== undefined && value !== null).length;
    if (filled === 0) continue;
    if (
      filled !== roadFields.length ||
      typeof shop.roadId !== "string" ||
      !Number.isFinite(shop.roadDistanceM) ||
      (shop.roadDistanceM as number) < 0 ||
      (shop.roadSide !== "left" && shop.roadSide !== "right") ||
      !Number.isFinite(shop.roadOffsetM) ||
      (shop.roadOffsetM as number) < 0 ||
      (shop.roadOffsetM as number) > 100
    ) {
      return `店番 ${shop.position} の道の上の位置が正しくありません`;
    }
  }
  return null;
}

/** 保存後の区画で、店番が重なっていないか */
function findDuplicatePosition(shops: EditableShop[]): number | null {
  const seen = new Set<number>();
  for (const shop of shops) {
    if (seen.has(shop.position)) return shop.position;
    seen.add(shop.position);
  }
  return null;
}

export async function GET() {
  try {
    const { error: authError } = await authorizeAdmin();
    if (authError) return NextResponse.json({ error: authError }, { status: 403 });

    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);

    const [editableShops, landmarks, mapRoute, roads, vendors, categories, mapSettingsLimits] = await Promise.all([
      loadEditableShops(supabase),
      fetchLandmarksFromDb(supabase),
      fetchMapRouteFromDb(supabase),
      loadEditableRoads(supabase),
      loadEditableVendors(supabase),
      loadVendorCategories(supabase),
      loadMapSettingsLimits(supabase),
    ]);

    return NextResponse.json({
      shops: editableShops,
      landmarks,
      route: mapRoute,
      roads,
      vendors,
      categories,
      mapSettingsLimits,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load map layout" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // 区画・割り当てを書き換え始めたら、途中で失敗しても公開マップの店舗キャッシュを捨てる
  let shopWritesStarted = false;
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-map-layout-put",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const { user, error: authError } = await authorizeAdmin();
    if (authError || !user) return NextResponse.json({ error: authError }, { status: 403 });

    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const adminWriteClient = createAdminWriteClient();

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
      // 空き区画から新しく登録した出店者（仮 id）と、情報を直した既存の出店者
      vendors?: { upsert?: EditableVendor[] };
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
      (body.roads !== undefined && !Array.isArray(body.roads)) ||
      (body.vendors !== undefined && !Array.isArray(body.vendors?.upsert))
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const shopFieldError = validateShopFields(body.shops.updated);
    if (shopFieldError) {
      return NextResponse.json({ error: shopFieldError }, { status: 400 });
    }

    const vendorsToWrite = body.vendors?.upsert ?? [];
    if (vendorsToWrite.length > 0) {
      const existingIds = vendorsToWrite.map((v) => v.id).filter((id) => typeof id === "string" && !id.startsWith(NEW_VENDOR_ID_PREFIX));
      const [existingResult, categories] = await Promise.all([
        existingIds.length > 0
          ? supabase.from("vendors").select("id").in("id", existingIds)
          : Promise.resolve({ data: [] as { id: string }[], error: null }),
        loadVendorCategories(supabase),
      ]);
      if (existingResult.error) {
        return NextResponse.json({ error: "Failed to validate vendors" }, { status: 500 });
      }
      const vendorError = validateVendorDrafts(vendorsToWrite, {
        existingVendorIds: new Set((existingResult.data ?? []).map((row) => row.id)),
        categoryIds: new Set(categories.map((c) => c.id)),
      });
      if (vendorError) {
        return NextResponse.json({ error: vendorError }, { status: 400 });
      }
    }
    // 区画に割り当てる新しい出店者（仮 id）は、同じ保存で登録するものに限る
    const newVendorIds = new Set(vendorsToWrite.map((v) => v.id).filter((id) => id.startsWith(NEW_VENDOR_ID_PREFIX)));
    const unknownNewVendor = body.shops.updated.find(
      (shop) => shop.vendorId?.startsWith(NEW_VENDOR_ID_PREFIX) && !newVendorIds.has(shop.vendorId)
    );
    if (unknownNewVendor) {
      return NextResponse.json({ error: `店番 ${unknownNewVendor.position} の出店者が見つかりません` }, { status: 400 });
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
    const [currentShops, currentRoads, mapSettingsLimits, currentRouteConfig] = await Promise.all([
      loadEditableShops(supabase),
      loadEditableRoads(supabase),
      loadMapSettingsLimits(supabase),
      loadRouteConfig(supabase),
    ]);

    // 保存後の道の形。道の一覧が送られてきたときは、送られてきた道の点で組み立てる
    // （道基準の位置を持つ区画の緯度経度は、この形から計算し直す）
    const bodyPointsByRoadId = new Map<string, MapRoutePoint[]>();
    for (const point of body.route.points) {
      if (!point.roadId) continue;
      const list = bodyPointsByRoadId.get(point.roadId) ?? [];
      list.push(point);
      bodyPointsByRoadId.set(point.roadId, list);
    }
    const roadsAfterSave: EditableRoad[] = body.roads
      ? body.roads.map((road) => ({ ...road, points: bodyPointsByRoadId.get(road.id) ?? [] }))
      : currentRoads;
    const roadIdsAfterSave = new Set(roadsAfterSave.map((road) => road.id));

    const shopsAfterSave = resolveSlotPositions(computeShopsAfterRequest(currentShops, body.shops), roadsAfterSave);
    const missingRoadShop = shopsAfterSave.find((shop) => shop.roadId && !roadIdsAfterSave.has(shop.roadId));
    if (missingRoadShop) {
      return NextResponse.json(
        { error: `店番 ${missingRoadShop.position} が乗っている道が見つかりません。道を削除する前に区画を移すか削除してください。` },
        { status: 400 }
      );
    }
    const duplicatePosition = findDuplicatePosition(shopsAfterSave);
    if (duplicatePosition != null) {
      return NextResponse.json({ error: `店番 ${duplicatePosition} が重複しています` }, { status: 400 });
    }

    // 送られてきた区画は、緯度経度をクライアントの値ではなく道の形から計算し直した値で書き込む
    const resolvedShopById = new Map(shopsAfterSave.map((shop) => [shop.locationId, shop]));
    const shopsToWrite = body.shops.updated.map((shop) => resolvedShopById.get(shop.locationId) ?? shop);
    // 送られてきていないが、乗っている道の形が変わったため位置が変わる区画（割り当ては触らない）
    const writtenLocationIds = new Set(body.shops.updated.map((shop) => shop.locationId));
    const currentShopById = new Map(currentShops.map((shop) => [shop.locationId, shop]));
    const repositionedShops = shopsAfterSave.filter((shop) => {
      if (writtenLocationIds.has(shop.locationId) || !shop.roadId) return false;
      const current = currentShopById.get(shop.locationId);
      return !!current && (current.lat !== shop.lat || current.lng !== shop.lng);
    });

    // 区画が乗っている道は削除できない（クライアント側の制約とサーバー側でも二重に検証）
    let removedRoadIds: string[] = [];
    if (body.roads) {
      const nextRoadIds = new Set(body.roads.map((road) => road.id));
      const roadsToRemove = currentRoads.filter((road) => !nextRoadIds.has(road.id));

      if (roadsToRemove.length > 0) {
        // DBから読み直しただけの状態ではなく、同一リクエスト内の位置更新・新規登録・削除を
        // 反映した「この保存が完了した後に存在するはずの区画一覧」（shopsAfterSave）で検証する
        // （そうしないと、直前に道へ移動した区画を見落としてその道の削除を誤って許可してしまう）。
        //
        // 道の形状も「保存前（DB）」ではなく「このリクエストで保存される形状」で判定する。
        // 削除される道自体は body.roads に含まれないため保存前の形状のままでよいが、
        // 残る道は body.route.points 側の新しい座標を使わないと、道の点をドラッグしつつ
        // 同じ保存操作で別の道を削除しようとした際に、古い（移動前の）座標のまま
        // 「区画が乗っている」と誤判定してしまう恐れがある
        const roadsForDistanceCheck: EditableRoad[] = [...roadsToRemove, ...roadsAfterSave];

        const snapDistanceMeters = body.route.config.snapDistanceMeters ?? 18;
        const roadIdsWithShops = findRoadIdsWithShops(shopsAfterSave, roadsForDistanceCheck, snapDistanceMeters);

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

    const nextUnassignedCount = shopsAfterSave.filter((s) => !s.vendorId).length;
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

    // ルート config（幅・スナップ距離・可視距離）だけを変えた保存でもスナップショットを残す
    const routeConfigChanged = isRouteConfigChanged(currentRouteConfig, body.route.config);

    const hasChanges =
      body.shops.updated.length > 0 ||
      body.shops.deletedLocationIds.length > 0 ||
      body.landmarks.upsert.length > 0 ||
      body.landmarks.deletedKeys.length > 0 ||
      routePointsChanged ||
      roadsChanged ||
      routeConfigChanged ||
      repositionedShops.length > 0 ||
      vendorsToWrite.length > 0;

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
          routeConfigChanged,
          updatedRoadCount: body.roads?.length,
          deletedRoadCount: removedRoadIds.length || undefined,
          repositionedShopCount: repositionedShops.length || undefined,
        },
        { shops: currentShops, roads: currentRoads }
      );
    }

    // 書き込みは save_map_layout RPC で1つのトランザクションにまとめる（途中で失敗したら全体が戻る）。
    // 道・道の点は、どちらも変わっていないとき（例: 店舗の担当者変更のみの保存）は書き込まない。
    // 道の点は全削除→全再挿入になるため、変更がない保存で毎回書き込むと無駄なDB書き込みになる
    const saveRoads = routePointsChanged || roadsChanged;
    shopWritesStarted = true;
    const { error: saveError } = await adminWriteClient.rpc("save_map_layout", {
      p_save_roads: saveRoads,
      p_roads: (body.roads ?? []).map((road) => ({
        id: road.id,
        name: road.name,
        kind: road.kind,
        widthMeters: road.widthMeters,
      })),
      p_points: body.route.points.map((point, index) => ({
        id: point.id,
        latitude: point.lat,
        longitude: point.lng,
        sort_order: index,
        branch_from_id: point.branchFromId ?? null,
        road_id: point.roadId ?? null,
      })),
      p_removed_road_ids: removedRoadIds,
      p_shops: shopsToWrite.map((shop) => ({
        locationId: shop.locationId,
        position: shop.position,
        lat: shop.lat,
        lng: shop.lng,
        chome: shop.chome ?? null,
        vendorId: shop.vendorId?.trim() || null,
        roadId: shop.roadId ?? null,
        roadDistanceM: shop.roadDistanceM ?? null,
        roadSide: shop.roadSide ?? null,
        roadOffsetM: shop.roadOffsetM ?? null,
      })),
      p_shop_positions: repositionedShops.map((shop) => ({ locationId: shop.locationId, lat: shop.lat, lng: shop.lng })),
      p_deleted_location_ids: body.shops.deletedLocationIds,
      p_landmarks: body.landmarks.upsert,
      p_deleted_landmark_keys: body.landmarks.deletedKeys,
      p_route_config: body.route.config,
      p_vendors: vendorsToWrite.map((vendor) => ({
        id: vendor.id,
        name: vendor.name.trim(),
        categoryId: vendor.categoryId,
        strength: vendor.strength.trim(),
        mainProducts: vendor.mainProducts.map((product) => product.trim()),
      })),
    });

    if (saveError) {
      console.error("[admin/map-layout] save_map_layout failed:", saveError.message);
      return NextResponse.json({ error: "Failed to save map layout" }, { status: 500 });
    }

    // 出店者の登録・更新は、配置（スナップショットで戻せる）と違って戻せないため監査ログに残す
    if (vendorsToWrite.length > 0) {
      const created = vendorsToWrite.filter((v) => v.id.startsWith(NEW_VENDOR_ID_PREFIX));
      const updated = vendorsToWrite.filter((v) => !v.id.startsWith(NEW_VENDOR_ID_PREFIX));
      await logAdminAudit(
        adminWriteClient,
        { id: user.id, email: user.email, role: getRole(user) },
        {
          action: "map_edit_save_vendors",
          targetType: "vendor",
          targetId: updated.map((v) => v.id).join(",") || null,
          targetName: vendorsToWrite.map((v) => v.name.trim()).join(", ").slice(0, 500),
          details: `マップ編集から出店者を新規登録 ${created.length} 件・更新 ${updated.length} 件`,
        }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save map layout" }, { status: 500 });
  } finally {
    if (shopWritesStarted) revalidatePublicShops();
  }
}
