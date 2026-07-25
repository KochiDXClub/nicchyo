import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Shop } from "../types/shopData";

type VendorRow = {
  id: string;
  shop_name: string | null;
  owner_name: string | null;
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
  sns_instagram: string | null;
  sns_x: string | null;
  sns_hp: string | null;
  business_hours_start: string | null;
  business_hours_end: string | null;
};

type ActiveContentRow = {
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

type ProductRow = {
  vendor_id: string | null;
  name: string | null;
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

export async function fetchVendorShopsFromDb(
  supabase: SupabaseClient<Database>
): Promise<Shop[]> {
  const [
    { data: vendorsData },
    { data: categoriesData },
    { data: productsData },
    { data: locationsData },
    { data: assignmentsData },
    { data: activeContentsData },
  ] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, shop_name, owner_name, strength, style, style_tags, category_id, categories(name), main_products, main_product_prices, payment_methods, rain_policy, schedule, shop_image_url, sns_instagram, sns_x, sns_hp, business_hours_start, business_hours_end"),
    supabase.from("categories").select("id, name"),
    supabase.from("products").select("vendor_id, name"),
    supabase
      .from("market_locations")
      .select("id, store_number, latitude, longitude, district"),
    supabase.from("location_assignments").select("vendor_id, location_id, market_date"),
    supabase
      .from("vendor_contents")
      .select("id, vendor_id, body, image_url, expires_at, created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const vendors = Array.isArray(vendorsData)
    ? (vendorsData as VendorRow[])
    : [];
  const categories = Array.isArray(categoriesData)
    ? (categoriesData as CategoryRow[])
    : [];
  const products = Array.isArray(productsData)
    ? (productsData as ProductRow[])
    : [];
  const locations = Array.isArray(locationsData)
    ? (locationsData as LocationRow[])
    : [];
  const assignments = Array.isArray(assignmentsData)
    ? (assignmentsData as AssignmentRow[])
    : [];

  const categoryNameById = new Map<string, string>();
  categories.forEach((row) => {
    if (row.id && row.name) {
      categoryNameById.set(row.id, row.name);
    }
  });

  const productsByVendor = new Map<string, string[]>();
  products.forEach((row) => {
    if (!row.vendor_id || !row.name) return;
    const list = productsByVendor.get(row.vendor_id) ?? [];
    list.push(row.name);
    productsByVendor.set(row.vendor_id, list);
  });

  // 有効期限内の投稿を vendor_id ごとに時系列で保持
  const activeContents = Array.isArray(activeContentsData)
    ? (activeContentsData as ActiveContentRow[])
    : [];
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
        ownerName: vendor.owner_name ?? "",
        category: categoryName,
        products: displayProducts,
        productPrices: (vendor.main_product_prices ?? undefined) as Record<string, number | null> | undefined,
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
        images: vendor.shop_image_url ? { main: vendor.shop_image_url } : undefined,
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

  return Array.from(dedupedByStoreNumber.values())
    .sort((a, b) => a.id - b.id)
    .map(({ assignmentMarketDate: _assignmentMarketDate, ...shop }) => shop);
}

export const fetchShopsFromDb = fetchVendorShopsFromDb;
