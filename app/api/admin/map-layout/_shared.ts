import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { fetchLandmarksFromDb } from "@/app/(public)/map/services/landmarksDb";
import { fetchMapRouteFromDb } from "@/app/(public)/map/services/mapRouteDb";
import {
  CHOME_ORDER,
  NEW_VENDOR_ID_PREFIX,
  VENDOR_FIELD_LIMITS,
  type EditableShop,
  type EditableVendor,
  type VendorCategory,
} from "@/app/(public)/map/types/editableShop";
import {
  DEFAULT_MAP_ROUTE_CONFIG,
  type MapRoad,
  type MapRouteConfig,
  type MapRoutePoint,
  type RoadKind,
} from "@/app/(public)/map/types/mapRoute";
import { projectOntoRoad, roadIdOfSlot, type RoadSide } from "@/lib/map/roadSlotPosition";
import { DEFAULT_MAX_LANDMARKS, DEFAULT_MAX_UNASSIGNED_SHOP_MARKERS } from "@/lib/map/mapSettingsDefaults";

export type { EditableShop, EditableVendor, VendorCategory };

export type EditableRoad = MapRoad & {
  points: MapRoutePoint[];
};

const CHOME_VALUES = new Set<string>(CHOME_ORDER);

function normalizeChome(value: string | null): string | undefined {
  return value && CHOME_VALUES.has(value) ? value : undefined;
}

/** サービスロールキーで RLS を回避する管理用クライアント（lib/supabase/adminClient.ts を再利用） */
export function createAdminWriteClient(): SupabaseClient {
  const client = createAdminClient();
  if (!client) {
    throw new Error("Supabase service role env vars are missing.");
  }
  return client;
}

/** Postgres の「列が存在しない」エラー */
const UNDEFINED_COLUMN = "42703";

/**
 * 区画の道基準の位置（20261004110000_add_road_position_to_market_locations.sql）が
 * DB に入っているか。マイグレーションは main へのマージ後に承認を経て本番へ当たるため、
 * Preview や、リリース直後でマイグレーションの承認待ちの間は、アプリだけが新しくなって
 * 列がまだ無いことがある。その間も画面は開けるようにし、保存と移行処理だけを止める。
 * 同じマイグレーションで save_map_layout 等の関数も作るので、列があれば関数もある。
 */
export async function hasRoadPositionSchema(supabase: ReturnType<typeof createServerClient>): Promise<boolean> {
  const { error } = await supabase.from("market_locations").select("road_id").limit(1);
  if (!error) return true;
  if (error.code === UNDEFINED_COLUMN) return false;
  throw new Error("Failed to check map layout schema");
}

export const ROAD_POSITION_SCHEMA_MISSING_MESSAGE =
  "データベースの更新（マイグレーション）がまだ適用されていないため、保存できません。適用後にもう一度お試しください。";

type MarketLocationRow = {
  id: string | null;
  store_number: number | null;
  latitude: number | null;
  longitude: number | null;
  district: string | null;
  road_id?: string | null;
  road_distance_m?: number | null;
  road_side?: string | null;
  road_offset_m?: number | null;
};

/** 区画を読む。道基準の位置の列がまだ無い DB（マイグレーション前）では、その列なしで読む */
async function loadMarketLocationRows(supabase: ReturnType<typeof createServerClient>) {
  const withRoad = await supabase
    .from("market_locations")
    .select("id, store_number, latitude, longitude, district, road_id, road_distance_m, road_side, road_offset_m");
  if (withRoad.error?.code !== UNDEFINED_COLUMN) return withRoad as { data: MarketLocationRow[] | null; error: typeof withRoad.error };
  return (await supabase
    .from("market_locations")
    .select("id, store_number, latitude, longitude, district")) as { data: MarketLocationRow[] | null; error: typeof withRoad.error };
}

export async function loadEditableShops(supabase: ReturnType<typeof createServerClient>): Promise<EditableShop[]> {
  const [assignmentsResult, locationsResult, vendorsResult] = await Promise.all([
    supabase.from("location_assignments").select("vendor_id, location_id, market_date"),
    loadMarketLocationRows(supabase),
    supabase.from("vendors").select("id, shop_name"),
  ]);

  if (assignmentsResult.error || locationsResult.error || vendorsResult.error) {
    throw new Error("Failed to load shop location mappings");
  }

  const assignmentsData = assignmentsResult.data ?? [];
  const locationsData = locationsResult.data ?? [];
  const vendorsData = vendorsResult.data ?? [];

  const vendorNameById = new Map<string, string>();
  for (const row of vendorsData) {
    if (row.id) {
      vendorNameById.set(row.id as string, (row.shop_name as string | null) ?? "");
    }
  }

  const latestAssignmentByLocation = new Map<string, { vendor_id: string | null; market_date: string | null }>();
  for (const row of assignmentsData) {
    const locationId = row.location_id as string | null;
    if (!locationId) continue;
    const current = latestAssignmentByLocation.get(locationId);
    if (!current) {
      latestAssignmentByLocation.set(locationId, {
        vendor_id: (row.vendor_id as string | null) ?? null,
        market_date: (row.market_date as string | null) ?? null,
      });
      continue;
    }
    const currentDate = current.market_date ? new Date(current.market_date) : null;
    const nextDate = row.market_date ? new Date(row.market_date as string) : null;
    if (!currentDate || (nextDate && nextDate > currentDate)) {
      latestAssignmentByLocation.set(locationId, {
        vendor_id: (row.vendor_id as string | null) ?? null,
        market_date: (row.market_date as string | null) ?? null,
      });
    }
  }

  return locationsData
    .flatMap((row) => {
      const locationId = row.id as string | null;
      const storeNumber = Number(row.store_number ?? 0);
      const lat = Number(row.latitude ?? 0);
      const lng = Number(row.longitude ?? 0);

      if (!locationId || !Number.isFinite(storeNumber) || storeNumber <= 0) {
        return [];
      }

      const roadSide = row.road_side === "left" || row.road_side === "right" ? (row.road_side as RoadSide) : undefined;
      const hasRoadPosition =
        !!row.road_id && row.road_distance_m != null && !!roadSide && row.road_offset_m != null;

      const latestAssignment = latestAssignmentByLocation.get(locationId);
      const vendorId = latestAssignment?.vendor_id ?? undefined;
      const vendorName = vendorId ? vendorNameById.get(vendorId) ?? "" : "";

      return [
        {
          locationId,
          id: storeNumber,
          vendorId,
          name: vendorName || `未設定店舗 ${storeNumber}`,
          lat,
          lng,
          position: storeNumber,
          chome: normalizeChome((row.district as string | null) ?? null),
          ...(hasRoadPosition
            ? {
                roadId: row.road_id as string,
                roadDistanceM: Number(row.road_distance_m),
                roadSide,
                roadOffsetM: Number(row.road_offset_m),
              }
            : {}),
        },
      ];
    })
    .sort((a, b) => a.position - b.position);
}

/** マップ編集画面で扱う出店者の一覧（店名順） */
export async function loadEditableVendors(supabase: ReturnType<typeof createServerClient>): Promise<EditableVendor[]> {
  const { data, error } = await supabase
    .from("vendors")
    .select("id, shop_name, category_id, strength, main_products")
    .order("shop_name", { ascending: true });
  if (error) throw new Error("Failed to load vendors");
  return (data ?? []).map((row) => ({
    id: row.id,
    name: (row.shop_name || "名称未設定").trim(),
    categoryId: row.category_id ?? null,
    strength: row.strength ?? "",
    mainProducts: Array.isArray(row.main_products) ? row.main_products : [],
  }));
}

export async function loadVendorCategories(supabase: ReturnType<typeof createServerClient>): Promise<VendorCategory[]> {
  const { data, error } = await supabase.from("categories").select("id, name").order("name", { ascending: true });
  if (error) throw new Error("Failed to load categories");
  return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
}

/**
 * マップ編集画面から送られてきた出店者の追加・更新を検証する。問題があればその理由を返す。
 * 新しい出店者の id は NEW_VENDOR_ID_PREFIX で始まる仮 id、既存の出店者の id は DB にある id であること。
 */
export function validateVendorDrafts(
  vendors: EditableVendor[],
  context: { existingVendorIds: ReadonlySet<string>; categoryIds: ReadonlySet<string> }
): string | null {
  const seen = new Set<string>();
  for (const vendor of vendors) {
    if (!vendor || typeof vendor.id !== "string" || seen.has(vendor.id)) return "出店者のデータが正しくありません";
    seen.add(vendor.id);
    if (!vendor.id.startsWith(NEW_VENDOR_ID_PREFIX) && !context.existingVendorIds.has(vendor.id)) {
      return "存在しない出店者は更新できません";
    }
    const name = typeof vendor.name === "string" ? vendor.name.trim() : "";
    if (!name) return "店名を入れてください";
    if (name.length > VENDOR_FIELD_LIMITS.nameMaxLength) {
      return `店名は ${VENDOR_FIELD_LIMITS.nameMaxLength} 文字以内にしてください（${name.slice(0, 20)}…）`;
    }
    if (vendor.categoryId !== null && (typeof vendor.categoryId !== "string" || !context.categoryIds.has(vendor.categoryId))) {
      return `${name} のジャンルが正しくありません`;
    }
    if (typeof vendor.strength !== "string" || vendor.strength.length > VENDOR_FIELD_LIMITS.strengthMaxLength) {
      return `${name} のこだわりは ${VENDOR_FIELD_LIMITS.strengthMaxLength} 文字以内にしてください`;
    }
    if (
      !Array.isArray(vendor.mainProducts) ||
      vendor.mainProducts.length > VENDOR_FIELD_LIMITS.mainProductsMaxCount ||
      vendor.mainProducts.some(
        (product) => typeof product !== "string" || !product.trim() || product.length > VENDOR_FIELD_LIMITS.mainProductMaxLength
      )
    ) {
      return `${name} の主な商品は ${VENDOR_FIELD_LIMITS.mainProductsMaxCount} 件まで、1件 ${VENDOR_FIELD_LIMITS.mainProductMaxLength} 文字以内にしてください`;
    }
  }
  return null;
}

/**
 * map_route_points を road_id の有無に関わらず全件取得する。
 * スナップショット作成時、road_id が未設定のポイントも欠落させないために使う
 * （loadEditableRoads は road_id が付いた点しかバケツに入れないため代用できない）。
 */
export async function loadAllRoutePoints(supabase: ReturnType<typeof createServerClient>): Promise<MapRoutePoint[]> {
  const { data, error } = await supabase
    .from("map_route_points")
    .select("id, latitude, longitude, sort_order, branch_from_id, road_id")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error("Failed to load route points");
  }

  return (data ?? [])
    .filter((row) => row.id != null && row.latitude != null && row.longitude != null)
    .map((row) => ({
      id: row.id as string,
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      order: Number(row.sort_order ?? 0),
      branchFromId: (row.branch_from_id as string | null) ?? null,
      roadId: (row.road_id as string | null) ?? null,
    }));
}

export async function loadEditableRoads(supabase: ReturnType<typeof createServerClient>): Promise<EditableRoad[]> {
  const [roadsResult, allPoints] = await Promise.all([
    supabase.from("map_roads").select("id, name, kind, width_meters").order("created_at", { ascending: true }),
    loadAllRoutePoints(supabase),
  ]);

  if (roadsResult.error) {
    throw new Error("Failed to load roads");
  }

  // road_id が未設定の点（古いスナップショットの復元直後など）を黙って読み捨てると、
  // 次回保存時に replace_map_route_points が全置換されて完全に失われてしまう。
  // データを守るため、先頭の道に仮で割り当てて表示・保存対象に含める
  // （次回保存時にその道のroad_idとして永続化され、以降は正しく自己修復される）。
  // 「先頭の道」は created_at 昇順（最初に作られた道）で決定的に選ぶ
  // （クエリに .order() がないとPostgREST側の返却順に依存し非決定的になるため）。
  const fallbackRoadId = (roadsResult.data ?? [])[0]?.id as string | undefined;

  const pointsByRoadId = new Map<string, MapRoutePoint[]>();
  for (const point of allPoints) {
    const roadId = point.roadId ?? fallbackRoadId;
    if (!roadId) continue;
    const list = pointsByRoadId.get(roadId) ?? [];
    list.push(roadId === point.roadId ? point : { ...point, roadId });
    pointsByRoadId.set(roadId, list);
  }

  return (roadsResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null) ?? "",
    kind: (row.kind as RoadKind | null) ?? "street",
    widthMeters: Number(row.width_meters ?? 26),
    points: pointsByRoadId.get(row.id as string) ?? [],
  }));
}

export type MapSettingsLimits = {
  maxLandmarks: number;
  maxUnassignedShopMarkers: number;
};

const DEFAULT_MAP_SETTINGS_LIMITS: MapSettingsLimits = {
  maxLandmarks: DEFAULT_MAX_LANDMARKS,
  maxUnassignedShopMarkers: DEFAULT_MAX_UNASSIGNED_SHOP_MARKERS,
};

/**
 * map_route_configs の現在値（key="default"）を読む。行が無い・読めない場合は既定値を返す。
 * PUT でルート config だけ変更された保存でもスナップショットを残せるよう、
 * 保存前の値との比較（isRouteConfigChanged）に使う。
 */
export async function loadRouteConfig(
  supabase: ReturnType<typeof createServerClient>
): Promise<MapRouteConfig> {
  const { data, error } = await supabase
    .from("map_route_configs")
    .select("key, road_half_width_meters, snap_distance_meters, visible_distance_meters")
    .eq("key", DEFAULT_MAP_ROUTE_CONFIG.key)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_MAP_ROUTE_CONFIG;
  }

  const readNumber = (input: unknown, fallback: number) => {
    const n = Number(input);
    return input != null && Number.isFinite(n) ? n : fallback;
  };

  return {
    key: data.key ?? DEFAULT_MAP_ROUTE_CONFIG.key,
    roadHalfWidthMeters: readNumber(
      data.road_half_width_meters,
      DEFAULT_MAP_ROUTE_CONFIG.roadHalfWidthMeters
    ),
    snapDistanceMeters: readNumber(data.snap_distance_meters, DEFAULT_MAP_ROUTE_CONFIG.snapDistanceMeters),
    visibleDistanceMeters: readNumber(
      data.visible_distance_meters,
      DEFAULT_MAP_ROUTE_CONFIG.visibleDistanceMeters
    ),
  };
}

/** ルート config（幅・スナップ距離・可視距離）が保存前の値から変わっているか */
export function isRouteConfigChanged(current: MapRouteConfig, next: MapRouteConfig): boolean {
  return (
    current.key !== next.key ||
    current.roadHalfWidthMeters !== next.roadHalfWidthMeters ||
    current.snapDistanceMeters !== next.snapDistanceMeters ||
    current.visibleDistanceMeters !== next.visibleDistanceMeters
  );
}

/**
 * /admin/settings で管理者が設定する建物・未割当区画マーカーの上限を読み込む
 * （旧エディタが強制していた上限で、新エディタでも同様にサーバー側で検証する）。
 */
export async function loadMapSettingsLimits(
  supabase: ReturnType<typeof createServerClient>
): Promise<MapSettingsLimits> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "map")
    .maybeSingle();

  if (error || !data?.value || typeof data.value !== "object") {
    return DEFAULT_MAP_SETTINGS_LIMITS;
  }

  const record = data.value as Partial<MapSettingsLimits>;
  const readInt = (input: unknown, fallback: number) =>
    typeof input === "number" && Number.isFinite(input) ? Math.round(input) : fallback;

  return {
    maxLandmarks: readInt(record.maxLandmarks, DEFAULT_MAP_SETTINGS_LIMITS.maxLandmarks),
    maxUnassignedShopMarkers: readInt(
      record.maxUnassignedShopMarkers,
      DEFAULT_MAP_SETTINGS_LIMITS.maxUnassignedShopMarkers
    ),
  };
}

/**
 * 道削除時のバリデーション用に、区画1件ずつではなく1回のスキャンで
 * 「区画が乗っている道の id 集合」を求める（O(shops × roads) を1回だけ実行する）。
 */
export function findRoadIdsWithShops(
  shops: EditableShop[],
  roads: EditableRoad[],
  snapDistanceMeters: number
): Set<string> {
  const roadIds = new Set<string>();
  for (const shop of shops) {
    const roadId = roadIdOfSlot(shop, roads, snapDistanceMeters);
    if (roadId) roadIds.add(roadId);
  }
  return roadIds;
}

export type SlotRoadPositionPlan = {
  /** 自動で道基準の位置を入れられる区画 */
  matched: Array<{
    locationId: string;
    position: number;
    roadId: string;
    roadName: string;
    roadDistanceM: number;
    roadSide: RoadSide;
    roadOffsetM: number;
    /** 道基準の位置から計算し直した地点と、今の地点のずれ（m）。道の端より外にある区画で大きくなる */
    driftM: number;
  }>;
  /** どの道にも近くないため自動では変換しない区画 */
  unmatched: Array<{
    locationId: string;
    position: number;
    name: string;
    nearestRoadName: string | null;
    /** 最も近い道の中心線までの距離（m）。道が無ければ null */
    distanceToNearestRoadM: number | null;
  }>;
};

/**
 * 移行処理: 道基準の位置を持たない区画に、今の緯度経度から最も近い道の上の位置を求める。
 * 道の中心線から snapDistanceMeters より離れている区画は unmatched として報告し、変換しない。
 */
export function planSlotRoadPositions(
  shops: EditableShop[],
  roads: EditableRoad[],
  snapDistanceMeters: number
): SlotRoadPositionPlan {
  const plan: SlotRoadPositionPlan = { matched: [], unmatched: [] };
  const usableRoads = roads.filter((road) => road.points.length >= 2);

  for (const shop of shops) {
    if (shop.roadId) continue;
    let best: { road: EditableRoad; projection: NonNullable<ReturnType<typeof projectOntoRoad>> } | null = null;
    for (const road of usableRoads) {
      const projection = projectOntoRoad(road.points, shop);
      if (projection && (!best || projection.lateralM < best.projection.lateralM)) {
        best = { road, projection };
      }
    }

    if (best && best.projection.lateralM <= snapDistanceMeters) {
      plan.matched.push({
        locationId: shop.locationId,
        position: shop.position,
        roadId: best.road.id,
        roadName: best.road.name,
        roadDistanceM: best.projection.distanceM,
        roadSide: best.projection.side,
        roadOffsetM: best.projection.offsetM,
        driftM: best.projection.driftM,
      });
    } else {
      plan.unmatched.push({
        locationId: shop.locationId,
        position: shop.position,
        name: shop.name,
        nearestRoadName: best?.road.name ?? null,
        distanceToNearestRoadM: best ? best.projection.lateralM : null,
      });
    }
  }

  plan.matched.sort((a, b) => a.position - b.position);
  plan.unmatched.sort((a, b) => a.position - b.position);
  return plan;
}

export type SnapshotSummary = {
  updatedShopCount?: number;
  deletedShopCount?: number;
  upsertLandmarkCount?: number;
  deletedLandmarkCount?: number;
  updatedRoutePointCount?: number;
  routeConfigChanged?: boolean;
  updatedRoadCount?: number;
  deletedRoadCount?: number;
  restoreSourceSnapshotId?: string;
  /** 道の形が変わったために緯度経度を計算し直した区画の数 */
  repositionedShopCount?: number;
  /** 移行処理で道基準の位置を入れた区画の数 */
  migratedSlotCount?: number;
};

/**
 * 現在のマップ状態をスナップショットとして保存する。
 * preloaded が渡された場合は shops/roads を再取得せず、呼び出し側がすでに
 * 読み込んだデータをそのまま使う（PUT ハンドラの道削除バリデーションで読んだ
 * 状態と二重にDBへ問い合わせるのを避けるため）。
 */
export async function createMapLayoutSnapshot(
  supabase: ReturnType<typeof createServerClient>,
  adminWriteClient: SupabaseClient,
  createdBy: string,
  summary: SnapshotSummary,
  preloaded?: { shops: EditableShop[]; roads: EditableRoad[] }
): Promise<void> {
  const [shops, landmarks, roads, routePoints] = await Promise.all([
    preloaded ? Promise.resolve(preloaded.shops) : loadEditableShops(supabase),
    fetchLandmarksFromDb(supabase),
    preloaded ? Promise.resolve(preloaded.roads) : loadEditableRoads(supabase),
    // route_json は road_id を保持するため、fetchMapRouteFromDb（本番用・road_id非対応）
    // ではなく road_id が未設定の点も含めて全件取得する loadAllRoutePoints を使う
    loadAllRoutePoints(supabase),
  ]);
  const mapRoute = await fetchMapRouteFromDb(supabase);

  const { error } = await adminWriteClient.from("map_layout_snapshots").insert({
    shops_json: shops,
    landmarks_json: landmarks,
    route_json: routePoints,
    route_config_json: mapRoute.config,
    roads_json: roads.map(({ points: _points, ...road }) => road),
    created_by: createdBy,
    summary,
  });

  if (error) {
    throw new Error("Failed to create map layout snapshot");
  }
}
