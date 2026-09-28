import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  fetchVendorShopBaseRows: vi.fn(),
  fetchActiveContentRows: vi.fn(),
  buildVendorShops: vi.fn(),
}));

// unstable_cache は Next.js のサーバー外では動かないので、素通しにして中身だけを確かめる
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: mocks.revalidateTag,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));
vi.mock("./shopDb", () => ({
  fetchVendorShopBaseRows: mocks.fetchVendorShopBaseRows,
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
  });

  it("基本データと投稿を組み立てて返す", async () => {
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows: baseRows, failedTables: [] });

    await expect(fetchPublicShops()).resolves.toEqual([{ id: 1 }]);
    expect(mocks.buildVendorShops).toHaveBeenCalledWith(baseRows, []);
  });

  it("一部のテーブルが取れなかったときもキャッシュ外で取り直して表示を続ける", async () => {
    const partialRows = { ...baseRows, products: [{ vendor_id: "v1", name: "トマト" }] };
    mocks.fetchVendorShopBaseRows
      .mockResolvedValueOnce({ rows: baseRows, failedTables: ["vendors"] })
      .mockResolvedValueOnce({ rows: partialRows, failedTables: ["vendors"] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(fetchPublicShops()).resolves.toEqual([{ id: 1 }]);
    expect(mocks.fetchVendorShopBaseRows).toHaveBeenCalledTimes(2);
    expect(mocks.buildVendorShops).toHaveBeenCalledWith(partialRows, []);
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
