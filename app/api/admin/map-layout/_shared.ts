import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { authorizeAdmin } from "@/lib/auth/requireAdminApi";
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
 * 区画の道基準の位置・住所録の番号（20261004140000_add_road_position_and_numbers_to_market_locations.sql）が
 * DB に入っているか。マイグレーションは main へのマージ後に承認を経て本番へ当たるため、
 * Preview や、リリース直後でマイグレーションの承認待ちの間は、アプリだけが新しくなって
 * 列がまだ無いことがある。その間も画面は開けるようにし、保存と移行処理だけを止める。
 * 同じマイグレーションで save_map_layout 等の関数も作るので、列があれば関数もある。
 */
export async function hasRoadPositionSchema(supabase: ReturnType<typeof createServerClient>): Promise<boolean> {
  const { error } = await supabase.from("market_locations").select("road_id, official_number").limit(1);
  if (!error) return true;
  if (error.code === UNDEFINED_COLUMN) return false;
  throw new Error("Failed to check map layout schema");
}

export const ROAD_POSITION_SCHEMA_MISSING_MESSAGE =
  "データベースの更新（マイグレーション）がまだ適用されていないため、保存できません。適用後にもう一度お試しください。";

/**
 * マップ配置を書き込む API（保存 PUT・区画の位置の移行 POST）の共通の前処理。
 * 同一オリジンの確認 → 連続実行の制限 → 管理者の確認 → DB クライアントの用意 →
 * マイグレーション前でないかの確認、の順に行う（順番は各ルートで揃える必要があるため1か所にまとめる）。
 * 通らなければ返すべきレスポンスを、通ればユーザーとクライアントを返す。
 */
export async function prepareMapLayoutWrite(
  request: NextRequest,
  rateLimit: { bucket: string; limit: number }
): Promise<
  | { ok: false; response: Response }
  | {
      ok: true;
      user: NonNullable<Awaited<ReturnType<typeof authorizeAdmin>>["user"]>;
      supabase: ReturnType<typeof createServerClient>;
      adminWriteClient: SupabaseClient;
    }
> {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return { ok: false, response: originCheck.response };

  const rateLimited = await enforceRateLimit(request, { ...rateLimit, windowMs: 10 * 60 * 1000 });
  if (rateLimited) return { ok: false, response: rateLimited };

  const { user, error: authError } = await authorizeAdmin();
  if (authError || !user) return { ok: false, response: NextResponse.json({ error: authError }, { status: 403 }) };

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const adminWriteClient = createAdminWriteClient();

  if (!(await hasRoadPositionSchema(supabase))) {
    return { ok: false, response: NextResponse.json({ error: ROAD_POSITION_SCHEMA_MISSING_MESSAGE }, { status: 503 }) };
  }
  return { ok: true, user, supabase, adminWriteClient };
}

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
  official_number?: number | null;
  branch_number?: number | null;
};

/** 区画を読む。道基準の位置の列がまだ無い DB（マイグレーション前）では、その列なしで読む */
async function loadMarketLocationRows(supabase: ReturnType<typeof createServerClient>) {
  const withRoad = await supabase
    .from("market_locations")
    .select(
      "id, store_number, latitude, longitude, district, road_id, road_distance_m, road_side, road_offset_m, official_number, branch_number"
    );
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
          ...(row.official_number != null ? { officialNumber: Number(row.official_number) } : {}),
          ...(row.branch_number != null ? { branchNumber: Number(row.branch_number) } : {}),
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
 *
 * 既存の出店者は、今の DB の値から変わった項目だけを検証する。編集画面は、1つの項目を直しても
 * 出店者の全項目をまとめて送るので、すべてを検証すると、出店者本人が my-shop で登録した上限超えの
 * 値（品目が 11 件以上など。上限は画面側にしかない）が残っているだけで、店名を直した保存全体が
 * 400 になってしまう。新しい出店者は、すべての項目を検証する。
 */
export function validateVendorDrafts(
  vendors: EditableVendor[],
  context: { existingVendors: ReadonlyMap<string, EditableVendor>; categoryIds: ReadonlySet<string> }
): string | null {
  const seen = new Set<string>();
  for (const vendor of vendors) {
    if (!vendor || typeof vendor.id !== "string" || seen.has(vendor.id)) return "出店者のデータが正しくありません";
    seen.add(vendor.id);
    const isNew = vendor.id.startsWith(NEW_VENDOR_ID_PREFIX);
    const current = isNew ? undefined : context.existingVendors.get(vendor.id);
    if (!isNew && !current) return "存在しない出店者は更新できません";

    const name = typeof vendor.name === "string" ? vendor.name.trim() : "";
    if (!current || name !== current.name.trim()) {
      if (!name) return "店名を入れてください";
      if (name.length > VENDOR_FIELD_LIMITS.nameMaxLength) {
        return `店名は ${VENDOR_FIELD_LIMITS.nameMaxLength} 文字以内にしてください（${name.slice(0, 20)}…）`;
      }
    }
    if (!current || vendor.categoryId !== current.categoryId) {
      if (vendor.categoryId !== null && (typeof vendor.categoryId !== "string" || !context.categoryIds.has(vendor.categoryId))) {
        return `${name} のジャンルが正しくありません`;
      }
    }
    if (!current || vendor.strength !== current.strength) {
      if (typeof vendor.strength !== "string" || vendor.strength.length > VENDOR_FIELD_LIMITS.strengthMaxLength) {
        return `${name} のこだわりは ${VENDOR_FIELD_LIMITS.strengthMaxLength} 文字以内にしてください`;
      }
    }
    const productsChanged =
      !current ||
      !Array.isArray(vendor.mainProducts) ||
      vendor.mainProducts.length !== current.mainProducts.length ||
      vendor.mainProducts.some((product, index) => product !== current.mainProducts[index]);
    if (productsChanged) {
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
  }
  return null;
}

/**
 * map_route_points を road_id の有無に関わらず全件取得する。
 * スナップショット作成時、road_id が未設定のポイントも欠落させないために使う
 * （loadEditableRoads は road_id が付いた点しかバケツに入れないため代用できない）。
 */
/** 1回の保存で削除できる出店者の上限（誤操作や不正なリクエストで大量に消えるのを防ぐ） */
export const MAX_VENDOR_DELETIONS_PER_SAVE = 500;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 保存で削除する出店者の id を、DB を見る前に検査する。問題があればその理由、無ければ null。
 * - 保存後も区画に割り当てられている出店者は消せない（保存後の区画 = assignedVendorIds）
 * - 同じ保存で追加・更新する出店者は消せない（upsertVendorIds）
 */
export function validateVendorDeletionDraft(
  ids: unknown,
  context: { assignedVendorIds: Set<string>; upsertVendorIds: Set<string> }
): string | null {
  if (!Array.isArray(ids)) return "削除する出店者のデータが正しくありません";
  if (ids.length > MAX_VENDOR_DELETIONS_PER_SAVE) {
    return `1回の保存で削除できる出店者は ${MAX_VENDOR_DELETIONS_PER_SAVE} 件までです`;
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string" || !UUID_PATTERN.test(id) || seen.has(id)) {
      return "削除する出店者のデータが正しくありません";
    }
    seen.add(id);
    if (context.assignedVendorIds.has(id)) return "区画に割り当てられている出店者は削除できません";
    if (context.upsertVendorIds.has(id)) return "同じ保存で更新する出店者は削除できません";
  }
  return null;
}

/** エラー文に出す出店者の名前（多いときは先頭の数件と残りの件数）。名前が空なら id の先頭だけ */
export function describeVendors(ids: string[], vendors: { id: string; name: string }[], limit = 5): string {
  const nameById = new Map(vendors.map((v) => [v.id, v.name]));
  const labels = ids.map((id) => nameById.get(id) || `（名前なし ${id.slice(0, 8)}）`);
  const shown = labels.slice(0, limit).map((label) => `「${label}」`).join("、");
  return labels.length > limit ? `${shown} ほか ${labels.length - limit} 件` : shown;
}

/**
 * 削除しようとしている出店者について、DB に実在するもの・アカウント（店舗メンバー）に紐づくもの・
 * 削除する区画以外に割り当てが残っているものを調べる。
 *
 * 必ず管理用（service_role）のクライアントで呼ぶこと。ユーザーのセッションで読むと、shop_members の
 * RLS（自分の店舗のメンバーだけ読める）のせいで、他人の店舗のメンバーが 0 件に見えて検査が働かない。
 * アカウントに紐づく出店者は、ログインしている本人の店舗なので、マップ編集からは消さない
 */
export async function loadVendorDeletionTargets(
  adminClient: SupabaseClient,
  ids: string[],
  deletedLocationIds: string[]
): Promise<{ existing: { id: string; name: string }[]; withMembers: string[]; assignedElsewhere: string[]; error: boolean }> {
  const empty = { existing: [], withMembers: [], assignedElsewhere: [] as string[] };
  if (ids.length === 0) return { ...empty, error: false };
  // shop_members は生成した型定義（types/database.types.ts）にまだ無いので、型を緩めて読む
  const [vendorsResult, membersResult, assignmentsResult] = await Promise.all([
    adminClient.from("vendors").select("id, shop_name").in("id", ids),
    adminClient.from("shop_members").select("vendor_id").in("vendor_id", ids),
    adminClient.from("location_assignments").select("vendor_id, location_id").in("vendor_id", ids),
  ]);
  if (vendorsResult.error || membersResult.error || assignmentsResult.error) return { ...empty, error: true };
  const removedLocations = new Set(deletedLocationIds);
  return {
    existing: ((vendorsResult.data ?? []) as { id: string; shop_name: string | null }[]).map((row) => ({
      id: row.id,
      name: (row.shop_name ?? "").trim(),
    })),
    withMembers: Array.from(new Set(((membersResult.data ?? []) as { vendor_id: string }[]).map((row) => row.vendor_id))),
    // 割り当ては日付ごとに持てる。この保存で消える区画への割り当て以外が残っている出店者は消さない
    assignedElsewhere: Array.from(
      new Set(
        ((assignmentsResult.data ?? []) as { vendor_id: string; location_id: string | null }[])
          .filter((row) => !row.location_id || !removedLocations.has(row.location_id))
          .map((row) => row.vendor_id)
      )
    ),
    error: false,
  };
}

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

/** 現地で店舗を 1 件ずつ置くとき、スナップショットを作り直さない時間（分） */
export const RECENT_SNAPSHOT_MINUTES = 10;

/**
 * 同じ運営が直近（既定は 10 分以内）に作ったスナップショットがあれば、新しく作らない。
 * スナップショットは全店番の配置を丸ごと保存するので、300 店を 1 件ずつ現地で登録すると
 * 300 個になり、データが膨らみ、/admin/map-edit の「戻す」の一覧も同じ内容で埋まる。
 * 直近のものが残っていれば、その状態（＝今回の編集より前）へ戻せるので、戻せることは保てる。
 * @returns 新しく作ったら true、直近のものを使ったら false
 */
export async function ensureRecentMapLayoutSnapshot(
  supabase: ReturnType<typeof createServerClient>,
  adminWriteClient: SupabaseClient,
  createdBy: string,
  summary: SnapshotSummary,
  withinMinutes: number = RECENT_SNAPSHOT_MINUTES,
  now: Date = new Date()
): Promise<boolean> {
  const since = new Date(now.getTime() - withinMinutes * 60 * 1000).toISOString();
  const { data, error } = await adminWriteClient
    .from("map_layout_snapshots")
    .select("id")
    .eq("created_by", createdBy)
    .gte("created_at", since)
    .limit(1);

  // 調べられなかったときは、念のため作る（戻せないよりは、増えるほうがよい）
  if (!error && data && data.length > 0) return false;

  await createMapLayoutSnapshot(supabase, adminWriteClient, createdBy, summary);
  return true;
}

/**
 * 送られてきていないが、道の形が変わったために緯度経度を計算し直して書く区画を選ぶ。
 *
 * 対象は、点が実際に変わった（または新しくできた）道に乗っている区画だけ。
 * 移行（slot-road-positions）は緯度経度を変えずに道基準の位置だけを記録するので、
 * 道から計算した位置は元の緯度経度と少しずれる。道が変わっていないのに全区画を計算し直すと、
 * 関係のない保存のたびに公開マップ上で区画が動き、変更なしの保存でもスナップショットが増える。
 */
export function selectRepositionedShops({
  shopsAfterSave,
  currentShops,
  currentRoads,
  roadsAfterSave,
  writtenLocationIds,
}: {
  shopsAfterSave: EditableShop[];
  currentShops: EditableShop[];
  currentRoads: EditableRoad[];
  roadsAfterSave: EditableRoad[];
  writtenLocationIds: ReadonlySet<string>;
}): EditableShop[] {
  const roadPointsKey = (points: MapRoutePoint[]) =>
    points.map((point) => `${point.id}:${point.lat}:${point.lng}`).join("|");
  const currentRoadById = new Map(currentRoads.map((road) => [road.id, road]));
  const changedRoadIds = new Set(
    roadsAfterSave
      .filter((road) => {
        const current = currentRoadById.get(road.id);
        return !current || roadPointsKey(current.points) !== roadPointsKey(road.points);
      })
      .map((road) => road.id)
  );
  const currentShopById = new Map(currentShops.map((shop) => [shop.locationId, shop]));
  return shopsAfterSave.filter((shop) => {
    if (writtenLocationIds.has(shop.locationId) || !shop.roadId || !changedRoadIds.has(shop.roadId)) return false;
    const current = currentShopById.get(shop.locationId);
    return !!current && (current.lat !== shop.lat || current.lng !== shop.lng);
  });
}
