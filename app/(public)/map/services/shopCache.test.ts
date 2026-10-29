import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  fetchVendorShopBaseRows: vi.fn(),
  fetchVendorShopSupportRows: vi.fn(),
  fetchActiveContentRows: vi.fn(),
  buildVendorShops: vi.fn(),
  loadFullStore: vi.fn(),
  syncStore: vi.fn(),
}));

// unstable_cache は Next.js のサーバー外では動かないので、素通しにして中身だけを確かめる
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: mocks.revalidateTag,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));
vi.mock("./shopDb", () => ({
  fetchVendorShopBaseRows: mocks.fetchVendorShopBaseRows,
  fetchVendorShopSupportRows: mocks.fetchVendorShopSupportRows,
  fetchActiveContentRows: mocks.fetchActiveContentRows,
  buildVendorShops: mocks.buildVendorShops,
}));
vi.mock("./shopDelta", () => ({
  createSupabaseDeltaSource: () => ({}),
  loadFullStore: mocks.loadFullStore,
  syncStore: mocks.syncStore,
  storeToRows: (store: { vendors: unknown[]; products: unknown[] }) => store,
}));

const supportRows = { ownerProfiles: [], categories: [], locations: [], assignments: [] };
const store = { vendors: [{ id: "v1" }], products: [{ id: "p1", vendor_id: "v1", name: "トマト" }] };

async function loadModule() {
  vi.resetModules();
  return import("./shopCache");
}

describe("fetchPublicShops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T00:00:00Z"));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "anon-key");
    mocks.fetchActiveContentRows.mockResolvedValue([]);
    mocks.buildVendorShops.mockReturnValue([{ id: 1 }]);
    mocks.fetchVendorShopSupportRows.mockResolvedValue({ rows: supportRows, failedTables: [] });
    mocks.loadFullStore.mockResolvedValue(store);
    mocks.syncStore.mockResolvedValue(store);
  });

  it("差分更新で持っている店舗・商品と、小さいテーブルを合わせて組み立てる", async () => {
    const { fetchPublicShops } = await loadModule();

    await expect(fetchPublicShops()).resolves.toEqual([{ id: 1 }]);
    expect(mocks.buildVendorShops).toHaveBeenCalledWith({ ...store, ...supportRows }, []);
  });

  it("最初は全件を読み、間隔内の問い合わせは DB に行かず、間隔が過ぎたら差分だけを取る", async () => {
    const { fetchPublicShops, SHOP_DELTA_INTERVAL_MS } = await loadModule();

    await fetchPublicShops();
    await fetchPublicShops();
    expect(mocks.loadFullStore).toHaveBeenCalledTimes(1);
    expect(mocks.syncStore).not.toHaveBeenCalled();

    vi.advanceTimersByTime(SHOP_DELTA_INTERVAL_MS);
    await fetchPublicShops();
    expect(mocks.loadFullStore).toHaveBeenCalledTimes(1);
    expect(mocks.syncStore).toHaveBeenCalledTimes(1);
  });

  it("全件を読み直す間隔が過ぎたら、差分ではなく全件を取り直す", async () => {
    const { fetchPublicShops, SHOP_FULL_RELOAD_INTERVAL_MS } = await loadModule();

    await fetchPublicShops();
    vi.advanceTimersByTime(SHOP_FULL_RELOAD_INTERVAL_MS);
    await fetchPublicShops();

    expect(mocks.loadFullStore).toHaveBeenCalledTimes(2);
    expect(mocks.syncStore).not.toHaveBeenCalled();
  });

  it("同時に来た問い合わせは、取得を 1 回にまとめる", async () => {
    const { fetchPublicShops } = await loadModule();

    await Promise.all([fetchPublicShops(), fetchPublicShops(), fetchPublicShops()]);
    expect(mocks.loadFullStore).toHaveBeenCalledTimes(1);
  });

  it("差分の取得に失敗したら、前回のデータで表示を続け、すぐには取り直さない", async () => {
    const { fetchPublicShops, SHOP_DELTA_INTERVAL_MS } = await loadModule();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await fetchPublicShops();
    mocks.syncStore.mockRejectedValueOnce(new Error("down"));

    vi.advanceTimersByTime(SHOP_DELTA_INTERVAL_MS);
    await expect(fetchPublicShops()).resolves.toEqual([{ id: 1 }]);
    expect(mocks.buildVendorShops).toHaveBeenLastCalledWith({ ...store, ...supportRows }, []);
    expect(mocks.fetchVendorShopBaseRows).not.toHaveBeenCalled();

    await fetchPublicShops();
    expect(mocks.syncStore).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("最初の全件取得に失敗したときは、キャッシュ外で取り直して表示を続ける", async () => {
    const { fetchPublicShops } = await loadModule();
    const direct = { ...store, ...supportRows, products: [{ vendor_id: "v1", name: "トマト" }] };
    mocks.loadFullStore.mockRejectedValue(new Error("down"));
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows: direct, failedTables: [] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(fetchPublicShops()).resolves.toEqual([{ id: 1 }]);
    expect(mocks.buildVendorShops).toHaveBeenCalledWith(direct, []);
    warn.mockRestore();
  });

  it("小さいテーブルが取れなかったときもキャッシュ外で取り直して表示を続ける", async () => {
    const { fetchPublicShops } = await loadModule();
    const direct = { ...store, ...supportRows };
    mocks.fetchVendorShopSupportRows.mockResolvedValue({ rows: supportRows, failedTables: ["categories"] });
    mocks.fetchVendorShopBaseRows.mockResolvedValue({ rows: direct, failedTables: ["categories"] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(fetchPublicShops()).resolves.toEqual([{ id: 1 }]);
    expect(mocks.fetchVendorShopBaseRows).toHaveBeenCalledTimes(1);
    expect(mocks.buildVendorShops).toHaveBeenCalledWith(direct, []);
    warn.mockRestore();
  });

  it("環境変数が無ければ Supabase に問い合わせず空で返す", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const { fetchPublicShops } = await loadModule();

    await expect(fetchPublicShops()).resolves.toEqual([]);
    expect(mocks.loadFullStore).not.toHaveBeenCalled();
    expect(mocks.fetchVendorShopBaseRows).not.toHaveBeenCalled();
  });
});

describe("revalidatePublicShops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "anon-key");
    mocks.fetchActiveContentRows.mockResolvedValue([]);
    mocks.buildVendorShops.mockReturnValue([]);
    mocks.fetchVendorShopSupportRows.mockResolvedValue({ rows: supportRows, failedTables: [] });
    mocks.loadFullStore.mockResolvedValue(store);
    mocks.syncStore.mockResolvedValue(store);
  });

  it("小さいテーブルのキャッシュを即時に捨てる", async () => {
    const { revalidatePublicShops, SHOP_BASE_CACHE_TAG } = await loadModule();
    revalidatePublicShops();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(SHOP_BASE_CACHE_TAG, { expire: 0 });
  });

  it("次の問い合わせで、間隔を待たずに差分を取り、店舗の id を突き合わせ直す", async () => {
    const { fetchPublicShops, revalidatePublicShops } = await loadModule();
    await fetchPublicShops();

    revalidatePublicShops();
    await fetchPublicShops();

    expect(mocks.syncStore).toHaveBeenCalledTimes(1);
    expect(mocks.syncStore).toHaveBeenCalledWith(expect.anything(), store, expect.any(Number), { forceIdCheck: true });
  });
});
