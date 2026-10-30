import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAssignmentRows, fetchLocationRows, fetchProductRows } from "@/lib/shops/baseRowQueries";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import type { Database } from "@/types/database.types";
import { normalizeShopImageKind } from "@/lib/shopImages";
import type { Shop } from "../types/shopData";

// vendors から読む列。基本データの取得と差分の取得(fetchShopDelta)で同じ列を使う
const VENDOR_COLUMNS =
  "id, shop_name, strength, style, style_tags, category_id, categories(name), main_products, main_product_prices, payment_methods, rain_policy, schedule, shop_image_url, shop_image_kind, sns_instagram, sns_x, sns_hp, business_hours_start, business_hours_end" as const;

export type VendorRow = {
  id: string;
  shop_name: string | null;
  strength: string | null;
  style: string | null;
  style_tags: string[] | null;
  category_id: string | null;
  categories: { name: string | null }[] | { name: string | null } | null;
  main_products: string[] | null;
  main_product_prices: Record<string, number | null> | null;
  payment_methods: string[] | null;
  rain_policy: string | null;
  schedule: string[] | null;
  shop_image_url: string | null;
  shop_image_kind: string | null;
  sns_instagram: string | null;
  sns_x: string | null;
  sns_hp: string | null;
  business_hours_start: string | null;
  business_hours_end: string | null;
};

// 出店者本人の氏名は vendors から分離済み。
// 公開設定 (is_public = true) の行だけが RLS を通って返る。
type OwnerProfileRow = {
  vendor_id: string;
  owner_name: string | null;
};

export type ActiveContentRow = {
  id: string;
  vendor_id: string | null;
  body: string | null;
  image_url: string | null;
  expires_at: string;
  created_at: string;
};

type CategoryRow = {
  id: string;
  name: string | null;
};

export type ProductRow = {
  id: string;
  vendor_id: string | null;
  name: string | null;
  image_url: string | null;
};

type LocationRow = {
  id: string;
  store_number: number | null;
  latitude: number | null;
  longitude: number | null;
  district: string | null;
};

type AssignmentRow = {
  vendor_id: string | null;
  location_id: string | null;
  market_date: string | null;
};

type VisibleShopRow = Shop & {
  assignmentMarketDate: string | null;
};

const CHOME_VALUES = new Set([
  "一丁目",
  "二丁目",
  "三丁目",
  "四丁目",
  "五丁目",
  "六丁目",
  "七丁目",
]);

function normalizeChome(value: string | null): Shop["chome"] {
  if (value && CHOME_VALUES.has(value)) {
    return value as Shop["chome"];
  }
  return undefined;
}

/**
 * 店舗の基本データ（投稿以外）。
 * 更新がまれで 1 回あたりの転送量が大きい（数百 KB）ため、/map と /api/shops では
 * shopCache.ts 経由でキャッシュして使う。JSON にそのまま載る素の行だけを持たせる。
 */
export type VendorShopBaseRows = {
  vendors: VendorRow[];
  ownerProfiles: OwnerProfileRow[];
  categories: CategoryRow[];
  products: ProductRow[];
  locations: LocationRow[];
  assignments: AssignmentRow[];
};

export async function fetchVendorShopBaseRows(
  supabase: SupabaseClient<Database>
): Promise<{ rows: VendorShopBaseRows; failedTables: string[] }> {
  // PostgREST の max_rows (1000) で黙って切り詰められないよう、全テーブルを
  // 決定的な order 付きの range ページングで読み切る（lib/supabase/fetchAllRows.ts）
  const [
    { data: vendorsData, error: vendorsError },
    { data: ownerProfilesData, error: ownerProfilesError },
    { data: categoriesData, error: categoriesError },
    { data: productsData, error: productsError },
    { data: locationsData, error: locationsError },
    { data: assignmentsData, error: assignmentsError },
  ] = await Promise.all([
    fetchAllRows<VendorRow>(
      (from, to) =>
        supabase
          .from("vendors")
          .select(VENDOR_COLUMNS)
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: VendorRow[] | null; error: { message: string } | null }>,
      { label: "vendors" }
    ),
    fetchAllRows<OwnerProfileRow>(
      (from, to) =>
        supabase
          .from("vendor_owner_profiles")
          .select("vendor_id, owner_name")
          .order("vendor_id", { ascending: true })
          .range(from, to),
      { label: "vendor_owner_profiles" }
    ),
    fetchAllRows<CategoryRow>(
      (from, to) =>
        supabase.from("categories").select("id, name").order("id", { ascending: true }).range(from, to),
      { label: "categories" }
    ),
    fetchProductRows<ProductRow>(supabase),
    fetchLocationRows<LocationRow>(supabase),
    fetchAssignmentRows<AssignmentRow>(supabase),
  ]);

  // どれか1つでも失敗すると該当データが黙って空扱いになり店舗が減る/消えるため、
  // 原因追跡できるよう警告として残す（握りつぶし自体は既存の設計を踏襲）
  const failedTables: string[] = [];
  for (const [label, error] of [
    ["vendors", vendorsError],
    ["vendor_owner_profiles", ownerProfilesError],
    ["categories", categoriesError],
    ["products", productsError],
    ["market_locations", locationsError],
    ["location_assignments", assignmentsError],
  ] as const) {
    if (error) {
      console.warn(`[fetchVendorShopsFromDb] ${label} の取得に失敗しました:`, error.message);
      failedTables.push(label);
    }
  }

  return {
    rows: {
      vendors: Array.isArray(vendorsData) ? (vendorsData as VendorRow[]) : [],
      ownerProfiles: Array.isArray(ownerProfilesData)
        ? (ownerProfilesData as OwnerProfileRow[])
        : [],
      categories: Array.isArray(categoriesData) ? (categoriesData as CategoryRow[]) : [],
      products: Array.isArray(productsData) ? (productsData as ProductRow[]) : [],
      locations: Array.isArray(locationsData) ? (locationsData as LocationRow[]) : [],
      assignments: Array.isArray(assignmentsData) ? (assignmentsData as AssignmentRow[]) : [],
    },
    failedTables,
  };
}

/**
 * 基本データの取得(キャッシュ)以降に変わった行。キャッシュの上に重ねて、反映を早くする。
 *   vendors / products … updated_at が since より新しい行(DB のトリガーで必ず進む)
 *   deletedProductIds  … since 以降に消えた商品(product_deletions)
 * ログインしていない側のクライアントで読むこと(共有キャッシュに、ログイン中の人にだけ見える行が混ざらないように)。
 * 取れなかったときは投げる(unstable_cache に欠けた結果を載せないため)。
 */
export type ShopDelta = {
  vendors: VendorRow[];
  products: ProductRow[];
  deletedProductIds: string[];
};

export async function fetchShopDelta(supabase: SupabaseClient<Database>, since: string): Promise<ShopDelta> {
  // product_deletions は生成された型にまだ無いので、型なしで扱う
  const untyped = supabase as unknown as SupabaseClient;
  const [vendors, products, deletions] = await Promise.all([
    fetchAllRows<VendorRow>(
      (from, to) =>
        supabase
          .from("vendors")
          .select(VENDOR_COLUMNS)
          .gt("updated_at", since)
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: VendorRow[] | null; error: { message: string } | null }>,
      { label: "vendors(delta)" }
    ),
    fetchAllRows<ProductRow>(
      (from, to) =>
        supabase
          .from("products")
          .select("id, vendor_id, name, image_url")
          .gt("updated_at", since)
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: ProductRow[] | null; error: { message: string } | null }>,
      { label: "products(delta)" }
    ),
    fetchAllRows<{ product_id: string }>(
      (from, to) =>
        untyped
          .from("product_deletions")
          .select("product_id")
          .gt("deleted_at", since)
          .order("product_id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: { product_id: string }[] | null; error: { message: string } | null }>,
      { label: "product_deletions" }
    ),
  ]);
  const failed = [
    ["vendors", vendors.error],
    ["products", products.error],
    ["product_deletions", deletions.error],
  ].filter(([, error]) => error);
  if (failed.length > 0) throw new Error(`差分の取得に失敗しました: ${failed.map(([label]) => label).join(", ")}`);

  return {
    vendors: vendors.data,
    products: products.data,
    deletedProductIds: deletions.data.map((row) => row.product_id),
  };
}

/**
 * キャッシュした基本データに、差分を重ねる(元は変えない)。
 * 店舗・商品は id で置き換える(無ければ足す)。消えた商品は、変更より後に適用して確実に外す。
 * 重ねられるのは店舗・商品の追加と変更だけ。来訪者に出さなくなった店舗(許可の取り消し等)や削除された店舗、
 * 店主名の公開の取り消しは、差分では見えないので、15分ごとの全件の取り直しで外れる
 * (運営の画面での変更は、今までどおり即時にキャッシュを捨てる)。
 */
export function applyShopDelta(base: VendorShopBaseRows, delta: ShopDelta): VendorShopBaseRows {
  if (delta.vendors.length === 0 && delta.products.length === 0 && delta.deletedProductIds.length === 0) return base;

  const vendors = new Map(base.vendors.map((row) => [row.id, row]));
  delta.vendors.forEach((row) => vendors.set(row.id, row));

  const products = new Map(base.products.map((row) => [row.id, row]));
  delta.products.forEach((row) => products.set(row.id, row));
  delta.deletedProductIds.forEach((id) => products.delete(id));

  return { ...base, vendors: [...vendors.values()], products: [...products.values()] };
}

/** 有効期限内の投稿。期限切れがあるので基本データとは分けて毎回取る（数十 KB 程度） */
export async function fetchActiveContentRows(
  supabase: SupabaseClient<Database>
): Promise<ActiveContentRow[]> {
  const { data, error } = await supabase
    .from("vendor_contents")
    .select("id, vendor_id, body, image_url, expires_at, created_at")
    // RLS の「vendors can read own contents」ポリシー（状態条件なし）が
    // OR 結合されるため、認証済みベンダーのセッションで本人の hidden/deleted
    // 投稿がマップバナーに紛れ込まないよう明示する（/api/stories と同じ対策）
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[fetchActiveContentRows] vendor_contents の取得に失敗しました:", error.message);
    return [];
  }
  return Array.isArray(data) ? (data as ActiveContentRow[]) : [];
}

export async function fetchVendorShopsFromDb(
  supabase: SupabaseClient<Database>
): Promise<Shop[]> {
  const [{ rows }, activeContents] = await Promise.all([
    fetchVendorShopBaseRows(supabase),
    fetchActiveContentRows(supabase),
  ]);
  return buildVendorShops(rows, activeContents);
}

export function buildVendorShops(
  base: VendorShopBaseRows,
  activeContents: ActiveContentRow[]
): Shop[] {
  const { vendors, categories, products, locations, assignments } = base;
  const ownerNameByVendorId = new Map<string, string>();
  base.ownerProfiles.forEach((row) => {
    if (row.vendor_id && row.owner_name) {
      ownerNameByVendorId.set(row.vendor_id, row.owner_name);
    }
  });

  const categoryNameById = new Map<string, string>();
  categories.forEach((row) => {
    if (row.id && row.name) {
      categoryNameById.set(row.id, row.name);
    }
  });

  const productsByVendor = new Map<string, string[]>();
  // 商品の写真は products テーブルの「同じ名前の商品」の行に置かれる（出店者の保存・現場登録とも）。
  // バナーは商品名で引き当てるので、写真のある行だけを名前と組にして持たせる
  const productDetailsByVendor = new Map<string, NonNullable<Shop["productDetails"]>>();
  products.forEach((row) => {
    if (!row.vendor_id || !row.name) return;
    const list = productsByVendor.get(row.vendor_id) ?? [];
    list.push(row.name);
    productsByVendor.set(row.vendor_id, list);
    if (row.image_url) {
      const details = productDetailsByVendor.get(row.vendor_id) ?? [];
      details.push({ name: row.name, imageUrl: row.image_url });
      productDetailsByVendor.set(row.vendor_id, details);
    }
  });

  // 有効期限内の投稿を vendor_id ごとに時系列で保持
  const activeContentsByVendor = new Map<string, ActiveContentRow[]>();
  activeContents.forEach((row) => {
    if (!row.vendor_id) return;
    const list = activeContentsByVendor.get(row.vendor_id) ?? [];
    list.push(row);
    activeContentsByVendor.set(row.vendor_id, list);
  });

  const locationById = new Map<string, LocationRow>();
  locations.forEach((row) => {
    if (row.id) {
      locationById.set(row.id, row);
    }
  });

  const latestAssignmentByVendor = new Map<string, AssignmentRow>();
  assignments.forEach((row) => {
    if (!row.vendor_id || !row.location_id) return;
    const current = latestAssignmentByVendor.get(row.vendor_id);
    if (!current) {
      latestAssignmentByVendor.set(row.vendor_id, row);
      return;
    }
    const currentDate = current.market_date ? new Date(current.market_date) : null;
    const nextDate = row.market_date ? new Date(row.market_date) : null;
    if (!currentDate || (nextDate && nextDate > currentDate)) {
      latestAssignmentByVendor.set(row.vendor_id, row);
    }
  });

  const shops = vendors
    .map((vendor): VisibleShopRow | null => {
      const assignment = latestAssignmentByVendor.get(vendor.id);
      if (!assignment?.location_id) return null;
      const location = locationById.get(assignment.location_id);
      if (!location) return null;

      const storeNumber = Number(location.store_number ?? 0);
      if (!Number.isFinite(storeNumber) || storeNumber <= 0) return null;

      // JOIN で取得したカテゴリー名を優先、なければ Map フォールバック
      const catRaw = vendor.categories;
      const joinedCategoryName = Array.isArray(catRaw)
        ? (catRaw[0]?.name ?? null)
        : ((catRaw as { name: string | null } | null)?.name ?? null);
      const categoryName =
        joinedCategoryName ||
        (vendor.category_id && categoryNameById.get(vendor.category_id)) ||
        "";

      // main_products が設定されていればそちらを優先、なければ products テーブルから
      const displayProducts =
        (vendor.main_products ?? []).length > 0
          ? (vendor.main_products as string[])
          : (productsByVendor.get(vendor.id) ?? []);

      // 出店予定日: text[] を '、' で結合
      const scheduleStr = (vendor.schedule ?? []).join("、");

      // 有効期限内の投稿一覧と、その先頭1件
      const contents = activeContentsByVendor.get(vendor.id) ?? [];
      const activePosts =
        contents.length > 0
          ? contents.map((content) => ({
              id: content.id,
              text: content.body ?? "",
              imageUrl: content.image_url ?? undefined,
              expiresAt: content.expires_at,
              createdAt: content.created_at,
            }))
          : undefined;
      const activePost = activePosts?.[0];

      return {
        id: storeNumber,
        vendorId: vendor.id,
        name: vendor.shop_name ?? "",
        ownerName: ownerNameByVendorId.get(vendor.id) ?? "",
        category: categoryName,
        products: displayProducts,
        productPrices: (vendor.main_product_prices ?? undefined) as Record<string, number | null> | undefined,
        productDetails: productDetailsByVendor.get(vendor.id),
        description: "",
        stallStyle: vendor.style ?? undefined,
        stallStyleTags: (vendor.style_tags ?? []).length > 0 ? (vendor.style_tags as string[]) : undefined,
        schedule: scheduleStr,
        message: undefined,
        shopStrength: vendor.strength ?? undefined,
        paymentMethods: (vendor.payment_methods ?? []) as string[],
        rainPolicy: vendor.rain_policy ?? undefined,
        activePosts,
        activePost,
        images: vendor.shop_image_url
          ? { main: vendor.shop_image_url, mainKind: normalizeShopImageKind(vendor.shop_image_kind) }
          : undefined,
        socialLinks: (vendor.sns_instagram || vendor.sns_x || vendor.sns_hp) ? {
          instagram: vendor.sns_instagram ?? undefined,
          twitter: vendor.sns_x ?? undefined,
          website: vendor.sns_hp ?? undefined,
        } : undefined,
        businessHoursStart: vendor.business_hours_start ?? undefined,
        businessHoursEnd: vendor.business_hours_end ?? undefined,
        position: storeNumber,
        lat: Number(location.latitude ?? 0),
        lng: Number(location.longitude ?? 0),
        chome: normalizeChome(location.district),
        assignmentMarketDate: assignment.market_date ?? null,
      };
    })
    .filter((row): row is VisibleShopRow => row !== null);

  const dedupedByStoreNumber = new Map<number, VisibleShopRow>();
  for (const shop of shops) {
    const current = dedupedByStoreNumber.get(shop.id);
    if (!current) {
      dedupedByStoreNumber.set(shop.id, shop);
      continue;
    }

    const currentDate = current.assignmentMarketDate ? new Date(current.assignmentMarketDate) : null;
    const nextDate = shop.assignmentMarketDate ? new Date(shop.assignmentMarketDate) : null;
    const shouldReplace = !currentDate || (nextDate && nextDate > currentDate);

    console.warn(
      `[fetchVendorShopsFromDb] duplicate store_number detected: ${shop.id} (${current.name} / ${shop.name})`
    );

    if (shouldReplace) {
      dedupedByStoreNumber.set(shop.id, shop);
    }
  }

  // assignmentMarketDate は「今日この店が出ているか」の判定に使うので、
  // 落とさずに Shop へそのまま渡す
  return Array.from(dedupedByStoreNumber.values()).sort((a, b) => a.id - b.id);
}

export const fetchShopsFromDb = fetchVendorShopsFromDb;
