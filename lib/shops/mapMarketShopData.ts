import { withCategory } from "@/lib/categories/catalog";
import { fetchCategories } from "@/lib/categories/server";
import { applyShopTranslations } from "@/lib/i18n/shopTranslation.server";
import type { Locale } from "@/lib/i18n/config";
import type { PublicMarket } from "@/lib/market/publicMarkets.server";
import type { ScheduleAdminData } from "@/lib/market-schedule/adminTypes";
import { managedVendorIdsForDate, publicAssignmentsForDate, publicVendorStatuses } from "@/lib/market-schedule/publicAssignments";
import type { Shop, ShopProfile } from "@/app/(public)/map/types/shopData";
import { buildVendorProfiles, buildVendorShops, type ActiveContentRow, type VendorShopBaseRows } from "@/app/(public)/map/services/shopDb";

export type MapMarketSelection = {
  markets: PublicMarket[];
  initial?: PublicMarket;
};

export function scopeShopLocations(base: VendorShopBaseRows, market: PublicMarket): VendorShopBaseRows {
  const locations = base.locations.filter((location) => location.market_id === market.id);
  const ids = new Set(locations.map((location) => location.id));
  return { ...base, locations, assignments: base.assignments.filter((row) => row.location_id && ids.has(row.location_id)) };
}

type MarketSchedule = { date: string; data: ScheduleAdminData };

export async function buildMarketShopData(
  base: VendorShopBaseRows,
  posts: ActiveContentRow[],
  selection: MapMarketSelection,
  schedules: ReadonlyMap<string, MarketSchedule>,
  visibleIds: ReadonlyMap<string, number>,
  hiddenOnlyVendors: ReadonlySet<string>,
  scheduleEnabled: boolean,
  locale: Locale,
): Promise<{ shops: Shop[]; profiles: ShopProfile[] }> {
  const categoriesPromise = fetchCategories().catch(() => []);
  const placements = new Map<string, Shop>();
  const statuses = new Map<string, ShopProfile["nextMarketStatus"]>();
  // 出店状況・配置を出した市（ラベルに市名を出すため）
  const statusMarkets = new Map<string, PublicMarket>();
  const placementMarkets = new Map<string, PublicMarket>();
  const markets = [...selection.markets].sort((a, b) => Number(b.id === selection.initial?.id) - Number(a.id === selection.initial?.id));
  const visible = new Set(visibleIds.keys());
  for (const market of markets) {
    const scoped = scopeShopLocations(base, market);
    const plan = schedules.get(market.id);
    const legacy = market.slug === "nichiyo" && !scheduleEnabled;
    if (!legacy && !plan) continue;

    if (plan) {
      const { data, date } = plan;
      const vendorStatuses = publicVendorStatuses(data, date, [...visible], market.weekday);
      const managed = managedVendorIdsForDate(data, date);
      scoped.assignments = publicAssignmentsForDate(data, date, scoped.assignments, visible, market.weekday).filter(
        (row) => row.vendor_id && (vendorStatuses.get(row.vendor_id) === "scheduled" || !managed.has(row.vendor_id))
      );
      scoped.vendors = scoped.vendors.flatMap((vendor) => {
        const publicId = visibleIds.get(vendor.id);
        return publicId === undefined ? [] : [{ ...vendor, public_shop_id: publicId }];
      });
      for (const [id, status] of vendorStatuses) {
        if (!statuses.has(id) || statuses.get(id) === "unknown") {
          statuses.set(id, status);
          statusMarkets.set(id, market);
        }
      }
    }
    const shops = legacy ? buildVendorShops(scoped, posts) : buildVendorShops(scoped, posts, {
      stableIds: true,
      useStoredRoadSide: market.slug !== "nichiyo",
    });
    for (const shop of shops) {
      if (!shop.vendorId) continue;
      const primary = placements.get(shop.vendorId);
      if (!primary) {
        placements.set(shop.vendorId, shop);
        placementMarkets.set(shop.vendorId, market);
        continue;
      }
      // 旧識別子の利用中も、日曜市に出る店舗のお気に入りは市を切り替えても同じ ID で扱う。
      if (legacy) primary.id = shop.id;
      const { lat, lng, position, chome, roadSide, assignmentMarketDate } = shop;
      (primary.otherMarketLocations ??= []).push({ marketId: market.id, lat, lng, position, chome, roadSide, assignmentMarketDate });
    }
  }

  const categories = await categoriesPromise;
  const positioned = [...placements.values()].sort((a, b) => a.id - b.id);
  if (!scheduleEnabled) {
    const shops = await applyShopTranslations(positioned.map((shop) => withCategory(shop, categories)), locale);
    return { shops, profiles: shops };
  }

  const publicBase = { ...base, vendors: base.vendors.filter((vendor) => !hiddenOnlyVendors.has(vendor.id)) };
  const profiles = buildVendorProfiles(publicBase, posts, visibleIds).map((profile) => {
    const location = placements.get(profile.vendorId ?? "");
    const vendorId = profile.vendorId ?? "";
    const labelMarket = location ? placementMarkets.get(vendorId) : statusMarkets.get(vendorId);
    return withCategory({
      ...profile,
      nextMarketStatus: location ? "scheduled" as const : statuses.get(vendorId) ?? "unknown" as const,
      nextMarketLabel: labelMarket ? { name: labelMarket.name, weekday: labelMarket.weekday } : null,
      hasMapLocation: !!location,
      assignmentMarketDate: location?.assignmentMarketDate ?? null,
    }, categories);
  });
  const translated = await applyShopTranslations(profiles, locale);
  const byId = new Map(translated.map((profile) => [profile.id, profile]));
  const shops = positioned.flatMap((shop) => {
    const profile = byId.get(shop.id);
    return profile ? [{ ...shop, ...profile }] : [];
  });
  return { shops, profiles: translated };
}
