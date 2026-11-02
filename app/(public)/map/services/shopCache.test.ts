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
}));

// unstable_cache は Next.js のサーバー外では動かないので、素通しにして中身だけを確かめる
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: mocks.revalidateTag,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));
vi.mock("./shopDb", () => ({
  fetchVendorShopBaseRows: mocks.fetchVendorShopBaseRows,
  fetchShopDelta: mocks.fetchShopDelta,
  fetchVisibleVendorIds: mocks.fetchVisibleVendorIds,
  pruneInvisibleVendors: mocks.pruneInvisibleVendors,
  applyShopDelta: mocks.applyShopDelta,
  fetchActiveContentRows: mocks.fetchActiveContentRows,
  buildVendorShops: mocks.buildVendorShops,
}));

import { fetchPublicShops, revalidatePublicShops, SHOP_BASE_CACHE_TAG } from "./shopCache";

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
    mocks.buildVendorShops.mockReturnValue([{ id: 1 }]);
    mocks.fetchShopDelta.mockResolvedValue({ vendors: [], products: [], deletedProductIds: [], visibleVendorCount: 0 });
    // 既定では差分を重ねない(渡された基本データをそのまま返す)
    mocks.applyShopDelta.mockImplementation((base: unknown) => base);
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
