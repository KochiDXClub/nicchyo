import { expect, it, vi } from "vitest";
import type { VendorRow, VendorShopBaseRows } from "@/app/(public)/map/services/shopDb";
import type { ScheduleAdminData } from "@/lib/market-schedule/adminTypes";
import { buildMarketShopData } from "./mapMarketShopData";

vi.mock("@/lib/categories/server", () => ({ fetchCategories: async () => [] }));
vi.mock("@/lib/i18n/shopTranslation.server", () => ({ applyShopTranslations: async (rows: unknown[]) => rows }));

const sunday = { id: "sun", slug: "nichiyo", name: "日曜市", weekday: 0 };
const thursday = { id: "thu", slug: "mokuyo", name: "木曜市", weekday: 4 };
const sundaySlot = { id: "s", market_id: "sun", latitude: 33.562, longitude: 133.54, store_number: 12, district: null };
const thursdaySlot = { id: "t", market_id: "thu", latitude: 33.556, longitude: 133.531, store_number: 80, district: null };
const vendor = { id: "vendor", shop_name: "テスト商店" } as VendorRow;
const base: VendorShopBaseRows = {
  vendors: [vendor],
  products: [],
  ownerProfiles: [],
  categories: [],
  locations: [sundaySlot, thursdaySlot],
  assignments: [{ vendor_id: vendor.id, location_id: sundaySlot.id, market_date: "2026-11-15" }],
};
const schedule: ScheduleAdminData = {
  vendors: [],
  places: [{ ...thursdaySlot, official_number: null, branch_number: null, place_name: null }],
  memberships: [{ id: "m", vendor_id: vendor.id, location_id: "t", vendor_number: 1 }],
  periods: [{ id: "p", membership_id: "m", starts_on: "2026-11-12", ends_on: null }],
  rules: [{ id: "r", membership_id: "m", period_id: "p", cadence: "weekly", starts_on: "2026-11-12", ends_on: null, anchor_on: null, month_weeks: null }],
  overrides: [],
};
const plans = new Map([[thursday.id, { date: "2026-11-19", data: schedule }]]);
const ids = new Map([[vendor.id, 1001]]);

it("木曜を選ぶと木曜の区画を優先し、日曜にも出る店は旧IDを維持する", async () => {
  const { shops } = await buildMarketShopData(base, [], { markets: [sunday, thursday], initial: thursday }, plans, ids, new Set(), false, "ja");
  expect(shops).toHaveLength(1);
  expect(shops[0]).toMatchObject({
    id: 12, lat: thursdaySlot.latitude, lng: thursdaySlot.longitude, position: 80,
    otherMarketLocations: [{ marketId: sunday.id, lat: sundaySlot.latitude, position: 12 }],
  });
});

it("木曜が非公開になったら、キャッシュに木曜の区画や予定が残っていても返さない", async () => {
  const { shops } = await buildMarketShopData(base, [], { markets: [sunday], initial: sunday }, plans, ids, new Set(), false, "ja");
  expect(shops).toHaveLength(1);
  expect(shops[0]).toMatchObject({ id: 12, lat: sundaySlot.latitude, position: 12 });
  expect(shops[0].otherMarketLocations).toBeUndefined();
});
