import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  fetchVendorShopBaseRows: vi.fn(),
  fetchShopDelta: vi.fn(),
  fetchVisibleVendorIds: vi.fn(),
  pruneInvisibleVendors: vi.fn(),
  applyShopDelta: vi.fn(),
  fetchActiveContentRows: vi.fn(),
  buildVendorShops: vi.fn(),
  buildVendorProfiles: vi.fn(),
  readPublicScheduleRollout: vi.fn(),
  readPublicScheduleData: vi.fn(),
  fetchAllRows: vi.fn(),
  marketDay: vi.fn(),
}));

// unstable_cache は Next.js のサーバー外では動かないので、素通しにして中身だけを確かめる
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: mocks.revalidateTag,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));
vi.mock("@/lib/supabase/adminClient", () => ({ createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.marketDay }) }) }) }) }));
vi.mock("@/lib/market-schedule/read.server", () => ({ readPublicScheduleData: mocks.readPublicScheduleData }));
vi.mock("@/lib/supabase/fetchAllRows", () => ({ fetchAllRows: mocks.fetchAllRows }));
vi.mock("@/lib/market-schedule/rollout.server", () => ({ readPublicScheduleRollout: mocks.readPublicScheduleRollout }));
vi.mock("./shopDb", () => ({
  fetchVendorShopBaseRows: mocks.fetchVendorShopBaseRows,
  fetchShopDelta: mocks.fetchShopDelta,
  fetchVisibleVendorIds: mocks.fetchVisibleVendorIds,
  pruneInvisibleVendors: mocks.pruneInvisibleVendors,
  applyShopDelta: mocks.applyShopDelta,
  fetchActiveContentRows: mocks.fetchActiveContentRows,
  buildVendorShops: mocks.buildVendorShops,
  buildVendorProfiles: mocks.buildVendorProfiles,
}));

import { fetchPublicShopData, fetchPublicShops, revalidatePublicShops, SHOP_BASE_CACHE_TAG } from "./shopCache";

const baseRows = {
  vendors: [],
  ownerProfiles: [],
  categories: [],
  products: [],
  locations: [],
  assignments: [],
};

describe("fetchPublicShops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "anon-key");
    mocks.fetchActiveContentRows.mockResolvedValue([]);
    mocks.readPublicScheduleRollout.mockResolvedValue(false);
    mocks.marketDay.mockResolvedValue({ data: null, error: null });
    mocks.buildVendorShops.mockReturnValue([{ id: 1 }]);
    mocks.buildVendorProfiles.mockReturnValue([]);
    mocks.fetchShopDelta.mockResolvedValue({ vendors: [], products: [], deletedProductIds: [], visibleVendorCount: 0 });
    // 既定では差分を重ねない(渡された基本データをそのまま返す)
    mocks.applyShopDelta.mockImplementation((base: unknown) => base);
  });

  it("公開切替時は予定を使用し、非公開の店舗を固定IDの結果から除く", async () => {
    const rows = { ...baseRows, vendors: [{ id: "v1", shop_name: "公開" }, { id: "hidden", shop_name: "非公開" }], locations: [{ id: "place", store_number: 1 }], assignments: [] };
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows, failedTables: [] });
    mocks.fetchShopDelta.mockResolvedValue({ vendors: [], products: [], deletedProductIds: [], visibleVendorCount: 2 });
    mocks.readPublicScheduleRollout.mockResolvedValue(true);
    mocks.fetchAllRows.mockResolvedValue({ data: [{ id: "v1", public_shop_id: 1001 }], error: null });
    mocks.readPublicScheduleData.mockResolvedValue({ places: [{ id: "place" }], vendors: [], memberships: [{ id: "m", vendor_id: "v1", location_id: "place" }], periods: [{ id: "p", membership_id: "m", starts_on: "2020-01-01", ends_on: null }], rules: [{ id: "r", membership_id: "m", period_id: "p", cadence: "weekly", starts_on: "2020-01-05", ends_on: null }], overrides: [] });
    await fetchPublicShops();
    expect(mocks.buildVendorShops).toHaveBeenCalledWith(expect.objectContaining({ vendors: [{ id: "v1", shop_name: "公開", public_shop_id: 1001 }], assignments: [expect.objectContaining({ vendor_id: "v1", location_id: "place" })] }), [], { stableIds: true });
  });
  it("非出店・休市でも公開店舗プロフィールを残し、非公開店舗や地図座標を返さない", async () => {
    const rows = { ...baseRows, vendors: [{ id: "v1", shop_name: "公開" }, { id: "hidden", shop_name: "非公開" }], assignments: [] };
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows, failedTables: [] });
    mocks.fetchShopDelta.mockResolvedValue({ vendors: [], products: [], deletedProductIds: [], visibleVendorCount: 2 });
    mocks.readPublicScheduleRollout.mockResolvedValue(true);
    mocks.fetchAllRows.mockResolvedValue({ data: [{ id: "v1", public_shop_id: 1001 }], error: null });
    mocks.readPublicScheduleData.mockResolvedValue({ places: [], vendors: [], memberships: [], periods: [], rules: [], overrides: [] });
    mocks.marketDay.mockImplementation(async () => ({ data: { market_date: (await import("@/lib/time/jstDate")).nextSundayJstString(), status: "cancelled" }, error: null }));
    mocks.buildVendorShops.mockReturnValue([]);
    mocks.buildVendorProfiles.mockImplementation((base: typeof rows) => base.vendors.map((vendor) => ({ id: 1001, vendorId: vendor.id, name: vendor.shop_name, category: "", products: [] })));
    const result = await fetchPublicShopData();
    expect(result.shops).toEqual([]);
    expect(result.profiles).toEqual([expect.objectContaining({ id: 1001, vendorId: "v1", nextMarketStatus: "market_closed", hasMapLocation: false })]);
    expect(result.profiles[0]).not.toHaveProperty("lat");
  });
  it("予定・未設定・休市でプロフィールを保ち、公開済みで配置された店舗だけを地図に返す", async () => {
    const actual = await vi.importActual<typeof import("./shopDb")>("./shopDb");
    mocks.buildVendorProfiles.mockImplementation(actual.buildVendorProfiles);
    mocks.buildVendorShops.mockImplementation(actual.buildVendorShops);
    const rows = { ...baseRows, vendors: [{ id: "v1", shop_name: "出店する店" }, { id: "v2", shop_name: "未設定の店" }, { id: "private", shop_name: "非公開" }], locations: [{ id: "p", store_number: 1, latitude: 33.56, longitude: 133.53, district: null }] };
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows, failedTables: [] });
    mocks.fetchShopDelta.mockResolvedValue({ vendors: [], products: [], deletedProductIds: [], visibleVendorCount: 3 });
    mocks.readPublicScheduleRollout.mockResolvedValue(true);
    mocks.fetchAllRows.mockResolvedValue({ data: [{ id: "v1", public_shop_id: 1001 }, { id: "v2", public_shop_id: 1002 }], error: null });
    mocks.readPublicScheduleData.mockResolvedValue({ places: [{ id: "p" }], vendors: [], memberships: [{ id: "m", vendor_id: "v1", location_id: "p" }], periods: [{ id: "period", membership_id: "m", starts_on: "2020-01-01", ends_on: null }], rules: [{ id: "r", membership_id: "m", period_id: "period", cadence: "weekly", starts_on: "2020-01-05", ends_on: null }], overrides: [] });
    const active = await fetchPublicShopData();
    expect(active.shops.map((shop) => shop.id)).toEqual([1001]);
    expect(active.profiles).toEqual([expect.objectContaining({ id: 1001, nextMarketStatus: "scheduled", hasMapLocation: true }), expect.objectContaining({ id: 1002, nextMarketStatus: "unknown", hasMapLocation: false })]);
    const { addDaysToDateString, nextSundayJstString } = await import("@/lib/time/jstDate");
    const previousSunday = addDaysToDateString(nextSundayJstString(), -7);
    mocks.readPublicScheduleData.mockResolvedValue({ places: [{ id: "p" }], vendors: [], memberships: [{ id: "m", vendor_id: "v1", location_id: "p" }], periods: [{ id: "period", membership_id: "m", starts_on: "2020-01-01", ends_on: null }], rules: [{ id: "r", membership_id: "m", period_id: "period", cadence: "fortnightly", starts_on: previousSunday, ends_on: null, anchor_on: previousSunday }], overrides: [] });
    const offWeek = await fetchPublicShopData();
    expect(offWeek.shops).toEqual([]);
    expect(offWeek.profiles[0]).toMatchObject({ id: 1001, nextMarketStatus: "not_scheduled", hasMapLocation: false });
    mocks.marketDay.mockImplementation(async () => ({ data: { market_date: (await import("@/lib/time/jstDate")).nextSundayJstString(), status: "cancelled" }, error: null }));
    const closed = await fetchPublicShopData();
    expect(closed.shops).toEqual([]);
    expect(closed.profiles.map((profile) => [profile.id, profile.nextMarketStatus, profile.hasMapLocation])).toEqual([[1001, "market_closed", false], [1002, "market_closed", false]]);
  });
  it("公開設定の取得失敗時は古い識別子に戻さない", async () => {
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows: baseRows, failedTables: [] });
    mocks.readPublicScheduleRollout.mockRejectedValue(new Error("unavailable"));
    await expect(fetchPublicShops()).rejects.toThrow("unavailable");
    expect(mocks.buildVendorShops).not.toHaveBeenCalled();
  });
  it("休市情報を取得できない場合は古い予定を公開しない", async () => {
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows: baseRows, failedTables: [] });
    mocks.readPublicScheduleRollout.mockResolvedValue(true);
    mocks.fetchAllRows.mockResolvedValue({ data: [{ id: "v1", public_shop_id: 1001 }], error: null });
    mocks.readPublicScheduleData.mockResolvedValue({ places: [], vendors: [], memberships: [], periods: [], rules: [], overrides: [] });
    mocks.marketDay.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(fetchPublicShops()).rejects.toThrow("開催状況");
    expect(mocks.buildVendorShops).not.toHaveBeenCalled();
  });
  it("キャッシュされた予定があっても、最新の休市情報を優先する", async () => {
    const rows = { ...baseRows, vendors: [{ id: "v1", shop_name: "公開" }], assignments: [{ vendor_id: "v1", location_id: "p1", market_date: "2026-11-01" }] };
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows, failedTables: [] });
    mocks.fetchShopDelta.mockResolvedValue({ vendors: [], products: [], deletedProductIds: [], visibleVendorCount: 1 });
    mocks.readPublicScheduleRollout.mockResolvedValue(true);
    mocks.fetchAllRows.mockResolvedValue({ data: [{ id: "v1", public_shop_id: 1001 }], error: null });
    mocks.readPublicScheduleData.mockResolvedValue({ places: [], vendors: [], memberships: [], periods: [], rules: [], overrides: [] });
    mocks.marketDay.mockImplementation(async () => ({ data: { market_date: (await import("@/lib/time/jstDate")).nextSundayJstString(), status: "cancelled" }, error: null }));
    await fetchPublicShops();
    expect(mocks.buildVendorShops).toHaveBeenCalledWith(expect.objectContaining({ assignments: [] }), [], { stableIds: true });
  });
  it("基本データと投稿を組み立てて返す", async () => {
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows: baseRows, failedTables: [] });

    await expect(fetchPublicShops()).resolves.toEqual([{ id: 1 }]);
    expect(mocks.buildVendorShops).toHaveBeenCalledWith(baseRows, []);
  });

  it("基本データを取った時刻の少し前から変わった行を取り、基本データに重ねて組み立てる", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T05:00:00.000Z"));
    const delta = { vendors: [], products: [{ id: "p1", vendor_id: "v1", name: "白菜", image_url: "u" }], deletedProductIds: [], visibleVendorCount: 0 };
    const merged = { ...baseRows, products: delta.products };
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows: baseRows, failedTables: [] });
    mocks.fetchShopDelta.mockResolvedValue(delta);
    mocks.applyShopDelta.mockReturnValue(merged);

    await fetchPublicShops();
    vi.useRealTimers();

    // 余裕は1分
    expect(mocks.fetchShopDelta).toHaveBeenCalledWith(expect.anything(), "2026-10-29T04:59:00.000Z");
    expect(mocks.applyShopDelta).toHaveBeenCalledWith(baseRows, delta);
    expect(mocks.buildVendorShops).toHaveBeenCalledWith(merged, []);
  });

  it("見える店舗の数が合わなければ、店舗の id 一覧と突き合わせて、見えなくなった店舗を外す", async () => {
    const pruned = { ...baseRows, vendors: [] };
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows: baseRows, failedTables: [] });
    // キャッシュの店舗は 0 件だが、見える店舗は 1 件（数が合わない）
    mocks.fetchShopDelta.mockResolvedValue({ vendors: [], products: [], deletedProductIds: [], visibleVendorCount: 1 });
    mocks.fetchVisibleVendorIds.mockResolvedValue(["v1"]);
    mocks.pruneInvisibleVendors.mockReturnValue(pruned);

    await fetchPublicShops();

    expect(mocks.pruneInvisibleVendors).toHaveBeenCalledWith(baseRows, new Set(["v1"]));
    expect(mocks.buildVendorShops).toHaveBeenCalledWith(pruned, []);
  });

  it("店舗の数が合っていれば、店舗の id 一覧は取らない", async () => {
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows: baseRows, failedTables: [] });

    await fetchPublicShops();

    expect(mocks.fetchVisibleVendorIds).not.toHaveBeenCalled();
  });

  it("変わった行が取れなくても、基本データのまま表示を続ける", async () => {
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows: baseRows, failedTables: [] });
    mocks.fetchShopDelta.mockRejectedValue(new Error("boom"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(fetchPublicShops()).resolves.toEqual([{ id: 1 }]);
    expect(mocks.buildVendorShops).toHaveBeenCalledWith(baseRows, []);
    warn.mockRestore();
  });

  it("一部のテーブルが取れなかったときもキャッシュ外で取り直して表示を続ける", async () => {
    const partialRows = { ...baseRows, products: [{ id: "p1", vendor_id: "v1", name: "トマト", image_url: null }] };
    mocks.fetchVendorShopBaseRows
      .mockResolvedValueOnce({ rows: baseRows, failedTables: ["vendors"] })
      .mockResolvedValueOnce({ rows: partialRows, failedTables: ["vendors"] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(fetchPublicShops()).resolves.toEqual([{ id: 1 }]);
    expect(mocks.fetchVendorShopBaseRows).toHaveBeenCalledTimes(2);
    expect(mocks.buildVendorShops).toHaveBeenCalledWith(partialRows, []);
    // キャッシュ外で取り立てたデータには、差分を重ねない
    expect(mocks.fetchShopDelta).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("環境変数が無ければ Supabase に問い合わせず空で返す", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    await expect(fetchPublicShops()).resolves.toEqual([]);
    expect(mocks.fetchVendorShopBaseRows).not.toHaveBeenCalled();
  });
});

describe("revalidatePublicShops", () => {
  it("店舗キャッシュのタグを即時に捨てる", () => {
    revalidatePublicShops();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(SHOP_BASE_CACHE_TAG, { expire: 0 });
  });
});
