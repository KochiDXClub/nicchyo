import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Shop } from "@/app/(public)/map/data/shops";
import type {
  VendorRow,
  ProductRow,
  LocationRow,
  AssignmentRow,
  ActiveContentRow,
  SeasonalProductRow,
} from "./types";
import { normalizeChome, sanitizeLikeKeyword, getCurrentSeasonInfo, haversineKm } from "./consultUtils";

export async function fetchCandidateVendorIds(
  supabase: SupabaseClient<Database>,
  keywords: string[],
  targetShopName: string | null,
  embedding: number[] | null,
  seasonalVendorIds: string[] = []
): Promise<string[]> {
  const vendorIds = new Set<string>();
  seasonalVendorIds.forEach((vendorId) => {
    if (vendorId) vendorIds.add(vendorId);
  });
  const searchWords = [...new Set([...(targetShopName ? [targetShopName] : []), ...keywords])]
    .map(sanitizeLikeKeyword)
    .filter(Boolean)
    .slice(0, 5);

  // Run all keyword searches in parallel to avoid N+1 sequential queries
  await Promise.all(
    searchWords.map(async (word) => {
      const [vendorResult, productResult, categoryResult] = await Promise.all([
        supabase
          .from("vendors")
          .select("id")
          .or(
            [
              `shop_name.ilike.%${word}%`,
              `owner_name.ilike.%${word}%`,
              `strength.ilike.%${word}%`,
              `style.ilike.%${word}%`,
            ].join(",")
          )
          .limit(8),
        supabase
          .from("products")
          .select("vendor_id")
          .ilike("name", `%${word}%`)
          .limit(10),
        supabase
          .from("categories")
          .select("id")
          .ilike("name", `%${word}%`)
          .limit(5),
      ]);

      (vendorResult.data ?? []).forEach((row) => {
        if (row.id) vendorIds.add(row.id);
      });
      (productResult.data ?? []).forEach((row) => {
        if (row.vendor_id) vendorIds.add(row.vendor_id);
      });

      const categoryIds = (categoryResult.data ?? []).map((row) => row.id).filter(Boolean);
      if (categoryIds.length > 0) {
        const { data: categoryVendors } = await supabase
          .from("vendors")
          .select("id")
          .in("category_id", categoryIds)
          .limit(8);
        (categoryVendors ?? []).forEach((row) => {
          if (row.id) vendorIds.add(row.id);
        });
      }
    })
  );

  if (embedding) {
    const { data: embeddingMatches } = await supabase
      .rpc("match_vendor_embeddings", {
        query_embedding: embedding as unknown as string,
        match_count: 8,
        match_threshold: 0.45,
      })
      .returns<{ vendor_id: string; similarity: number }[]>();
    if (Array.isArray(embeddingMatches)) {
      embeddingMatches.forEach((row) => {
        if (row.vendor_id) vendorIds.add(row.vendor_id);
      });
    }
  }

  return Array.from(vendorIds).slice(0, 12);
}

export async function fetchSeasonalProductContext(
  supabase: SupabaseClient<Database>,
  seasonId: number
): Promise<SeasonalProductRow[]> {
  const { data: productSeasonRows } = await supabase
    .from("product_seasons")
    .select("product_id, season_id")
    .eq("season_id", seasonId)
    .limit(24);

  const productIds = (productSeasonRows ?? [])
    .map((row) => row.product_id)
    .filter((value): value is string => !!value);
  if (productIds.length === 0) return [];

  const { data: productsData } = await supabase
    .from("products")
    .select("id, vendor_id, name")
    .in("id", productIds);
  const products = Array.isArray(productsData) ? productsData : [];
  if (products.length === 0) return [];

  const vendorIds = Array.from(
    new Set(
      products
        .map((row) => row.vendor_id)
        .filter((value): value is string => !!value)
    )
  );
  const { data: vendorsData } =
    vendorIds.length > 0
      ? await supabase.from("vendors").select("id, shop_name").in("id", vendorIds)
      : { data: [] as { id: string; shop_name: string | null }[] };

  const vendorNameById = new Map<string, string>();
  (vendorsData ?? []).forEach((row) => {
    if (row.id) {
      vendorNameById.set(row.id, row.shop_name ?? "");
    }
  });

  const seasonName = getCurrentSeasonInfo().seasonName;
  return products
    .map((row) => {
      if (!row.vendor_id || !row.name) return null;
      return {
        vendorId: row.vendor_id,
        shopName: vendorNameById.get(row.vendor_id) ?? "",
        productName: row.name,
        seasonName,
      } satisfies SeasonalProductRow;
    })
    .filter((row): row is SeasonalProductRow => row !== null)
    .slice(0, 12);
}

export async function fetchShopsByVendorIds(
  supabase: SupabaseClient<Database>,
  vendorIds: string[]
): Promise<Shop[]> {
  if (vendorIds.length === 0) return [];

  const [
    { data: vendorsData },
    { data: productsData },
    { data: assignmentsData },
    { data: activeContentsData },
  ] = await Promise.all([
    supabase
      .from("vendors")
      .select(
        "id, shop_name, owner_name, strength, style, style_tags, category_id, categories(name), main_products, main_product_prices, payment_methods, rain_policy, schedule"
      )
      .in("id", vendorIds),
    supabase.from("products").select("vendor_id, name").in("vendor_id", vendorIds),
    supabase
      .from("location_assignments")
      .select("vendor_id, location_id, market_date")
      .in("vendor_id", vendorIds),
    supabase
      .from("vendor_contents")
      .select("vendor_id, body, image_url, expires_at, created_at")
      .in("vendor_id", vendorIds)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const vendors = Array.isArray(vendorsData) ? (vendorsData as VendorRow[]) : [];
  const products = Array.isArray(productsData) ? (productsData as ProductRow[]) : [];
  const assignments = Array.isArray(assignmentsData)
    ? (assignmentsData as AssignmentRow[])
    : [];
  const activeContents = Array.isArray(activeContentsData)
    ? (activeContentsData as ActiveContentRow[])
    : [];

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

  const locationIds = Array.from(
    new Set(
      Array.from(latestAssignmentByVendor.values())
        .map((row) => row.location_id)
        .filter((value): value is string => !!value)
    )
  );

  const { data: locationsData } =
    locationIds.length > 0
      ? await supabase
          .from("market_locations")
          .select("id, store_number, latitude, longitude, district")
          .in("id", locationIds)
      : { data: [] as LocationRow[] };

  const locations = Array.isArray(locationsData) ? (locationsData as LocationRow[]) : [];

  const productsByVendor = new Map<string, string[]>();
  products.forEach((row) => {
    if (!row.vendor_id || !row.name) return;
    const list = productsByVendor.get(row.vendor_id) ?? [];
    list.push(row.name);
    productsByVendor.set(row.vendor_id, list);
  });

  const activeContentsByVendor = new Map<string, ActiveContentRow[]>();
  activeContents.forEach((row) => {
    if (!row.vendor_id) return;
    const list = activeContentsByVendor.get(row.vendor_id) ?? [];
    list.push(row);
    activeContentsByVendor.set(row.vendor_id, list);
  });

  const locationById = new Map<string, LocationRow>();
  locations.forEach((row) => {
    if (row.id) locationById.set(row.id, row);
  });

  return vendors
    .map((vendor): Shop | null => {
      const assignment = latestAssignmentByVendor.get(vendor.id);
      if (!assignment?.location_id) return null;
      const location = locationById.get(assignment.location_id);
      if (!location) return null;
      const storeNumber = Number(location.store_number ?? 0);
      if (!Number.isFinite(storeNumber) || storeNumber <= 0) return null;

      const catRaw = vendor.categories;
      const joinedCategoryName = Array.isArray(catRaw)
        ? (catRaw[0]?.name ?? null)
        : ((catRaw as { name: string | null } | null)?.name ?? null);
      const displayProducts =
        (vendor.main_products ?? []).length > 0
          ? (vendor.main_products as string[])
          : (productsByVendor.get(vendor.id) ?? []);
      const scheduleStr = (vendor.schedule ?? []).join("、");
      const contents = activeContentsByVendor.get(vendor.id) ?? [];
      const activePosts =
        contents.length > 0
          ? contents.map((content) => ({
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
        category: joinedCategoryName ?? "",
        products: displayProducts,
        productPrices: (vendor.main_product_prices ?? undefined) as
          | Record<string, number | null>
          | undefined,
        description: "",
        stallStyle: vendor.style ?? undefined,
        stallStyleTags:
          (vendor.style_tags ?? []).length > 0
            ? (vendor.style_tags as string[])
            : undefined,
        schedule: scheduleStr,
        message: undefined,
        shopStrength: vendor.strength ?? undefined,
        paymentMethods: (vendor.payment_methods ?? []) as string[],
        rainPolicy: vendor.rain_policy ?? undefined,
        activePosts,
        activePost,
        position: storeNumber,
        lat: Number(location.latitude ?? 0),
        lng: Number(location.longitude ?? 0),
        chome: normalizeChome(location.district),
      };
    })
    .filter((shop): shop is Shop => shop !== null)
    .sort((a, b) => a.id - b.id);
}

export async function fetchShopByStoreNumber(
  supabase: SupabaseClient<Database>,
  storeNumber: number
): Promise<Shop | null> {
  const { data: locationsData } = await supabase
    .from("market_locations")
    .select("id")
    .eq("store_number", storeNumber)
    .limit(1);
  const locationId = locationsData?.[0]?.id;
  if (!locationId) return null;

  const { data: assignmentsData } = await supabase
    .from("location_assignments")
    .select("vendor_id, market_date")
    .eq("location_id", locationId)
    .order("market_date", { ascending: false })
    .limit(1);
  const vendorId = assignmentsData?.[0]?.vendor_id;
  if (!vendorId) return null;

  const shops = await fetchShopsByVendorIds(supabase, [vendorId]);
  return shops[0] ?? null;
}

export async function fetchShopByName(
  supabase: SupabaseClient<Database>,
  shopName: string
): Promise<Shop | null> {
  const keyword = sanitizeLikeKeyword(shopName);
  if (!keyword) return null;
  const { data } = await supabase
    .from("vendors")
    .select("id")
    .or(`shop_name.ilike.%${keyword}%,owner_name.ilike.%${keyword}%`)
    .limit(1);
  const vendorId = data?.[0]?.id;
  if (!vendorId) return null;
  const shops = await fetchShopsByVendorIds(supabase, [vendorId]);
  return shops[0] ?? null;
}

export function summarizeShops(shops: Shop[], limit = 6) {
  if (shops.length === 0) return "該当なし";
  return shops
    .slice(0, limit)
    .map((shop) => {
      const parts = [
        `id:${shop.id}`,
        shop.name ? `name:${shop.name}` : null,
        shop.ownerName ? `owner:${shop.ownerName}` : null,
        shop.category ? `category:${shop.category}` : null,
        shop.products.length > 0 ? `products:${shop.products.join(" / ")}` : null,
        shop.shopStrength ? `strength:${shop.shopStrength}` : null,
        shop.schedule ? `schedule:${shop.schedule}` : null,
      ].filter(Boolean);
      return parts.join(" | ");
    })
    .join("\n");
}

export function sortShopIdsByDistance(
  ids: number[],
  shops: Shop[],
  location: { lat: number; lng: number } | null
) {
  if (!location) return ids;
  return [...ids]
    .map((id) => {
      const shop = shops.find((candidate) => candidate.id === id);
      if (!shop) return { id, distance: Number.POSITIVE_INFINITY };
      return {
        id,
        distance: haversineKm(location, { lat: shop.lat, lng: shop.lng }),
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.id);
}
