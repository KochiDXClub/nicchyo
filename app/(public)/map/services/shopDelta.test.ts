import { describe, expect, it } from "vitest";
import type { ProductRow, VendorRow } from "./shopDb";
import {
  CURSOR_MARGIN_MS,
  ID_CHECK_INTERVAL_MS,
  loadFullStore,
  storeToRows,
  syncStore,
  type DeltaSource,
} from "./shopDelta";

const T0 = Date.parse("2026-10-29T00:00:00Z");
const at = (offsetMs: number) => new Date(T0 + offsetMs).toISOString();

type DbVendor = VendorRow & { visible: boolean };
type DbProduct = ProductRow & { deleted: boolean };

/** RLS を通った来訪者（anon）から見える範囲だけを返す、DB の代わり */
function fakeDb(vendors: DbVendor[], products: DbProduct[]) {
  const calls = { visibleVendorIds: 0, productsByVendorIds: [] as string[][], vendorsByIds: [] as string[][] };
  const visibleVendors = () => vendors.filter((v) => v.visible);
  const visibleProducts = () =>
    products.filter((p) => !p.deleted && visibleVendors().some((v) => v.id === p.vendor_id));
  const strip = <T extends object>(row: T & { visible?: boolean; deleted?: boolean }) => {
    const { visible: _visible, deleted: _deleted, ...rest } = row;
    return rest as unknown as T;
  };
  const newer = (row: { updated_at?: string | null }, since: string) => Date.parse(row.updated_at ?? "") > Date.parse(since);

  const source: DeltaSource = {
    allVendors: async () => visibleVendors().map(strip),
    allProducts: async () => visibleProducts().map(strip),
    changedVendors: async (since) => visibleVendors().filter((v) => newer(v, since)).map(strip),
    changedProducts: async (since) => visibleProducts().filter((p) => newer(p, since)).map(strip),
    deletedProductIds: async (since) =>
      products.filter((p) => p.deleted && newer(p, since)).map((p) => p.id as string),
    visibleVendorCount: async () => visibleVendors().length,
    visibleVendorIds: async () => (calls.visibleVendorIds++, visibleVendors().map((v) => v.id)),
    vendorsByIds: async (ids) => (calls.vendorsByIds.push(ids), visibleVendors().filter((v) => ids.includes(v.id)).map(strip)),
    productsByVendorIds: async (ids) =>
      (calls.productsByVendorIds.push(ids), visibleProducts().filter((p) => ids.includes(p.vendor_id as string)).map(strip)),
  };
  return { source, calls };
}

const vendor = (id: string, updatedOffsetMs: number, overrides: Partial<DbVendor> = {}): DbVendor => ({
  id,
  updated_at: at(updatedOffsetMs),
  shop_name: `店${id}`,
  strength: null,
  style: null,
  style_tags: null,
  category_id: null,
  main_products: null,
  main_product_prices: null,
  payment_methods: null,
  rain_policy: null,
  schedule: null,
  shop_image_url: null,
  sns_instagram: null,
  sns_x: null,
  sns_hp: null,
  business_hours_start: null,
  business_hours_end: null,
  visible: true,
  ...overrides,
});

const product = (id: string, vendorId: string, updatedOffsetMs: number, overrides: Partial<DbProduct> = {}): DbProduct => ({
  id,
  vendor_id: vendorId,
  name: `商品${id}`,
  image_url: null,
  updated_at: at(updatedOffsetMs),
  deleted: false,
  ...overrides,
});

const ids = (rows: { id?: string }[]) => rows.map((row) => row.id);

describe("差分更新（shopDelta）", () => {
  it("全件を読み、id の昇順で返す", async () => {
    const { source } = fakeDb([vendor("v2", 0), vendor("v1", 0)], [product("p2", "v1", 0), product("p1", "v1", 0)]);
    const store = await loadFullStore(source, T0);
    const rows = storeToRows(store);

    expect(ids(rows.vendors)).toEqual(["v1", "v2"]);
    expect(ids(rows.products)).toEqual(["p1", "p2"]);
  });

  it("変わった店舗・商品だけを取り、id で上書きする", async () => {
    const vendors = [vendor("v1", 0), vendor("v2", 0)];
    const products = [product("p1", "v1", 0)];
    const { source } = fakeDb(vendors, products);
    const store = await loadFullStore(source, T0);

    // 前回の基準より CURSOR_MARGIN_MS 以上あとに、店名・商品名を変えて、商品を足す
    vendors[0] = vendor("v1", CURSOR_MARGIN_MS + 1000, { shop_name: "新しい店名" });
    products[0] = product("p1", "v1", CURSOR_MARGIN_MS + 1000, { name: "新しい商品名" });
    products.push(product("p3", "v2", CURSOR_MARGIN_MS + 2000));
    const next = await syncStore(source, store, T0 + 60_000);
    const rows = storeToRows(next);

    expect(rows.vendors.find((v) => v.id === "v1")?.shop_name).toBe("新しい店名");
    expect(rows.products.map((p) => [p.id, p.name])).toEqual([
      ["p1", "新しい商品名"],
      ["p3", "商品p3"],
    ]);
  });

  it("引数の store は書き換えない（失敗しても中途半端な状態が残らない）", async () => {
    const vendors = [vendor("v1", 0)];
    const { source } = fakeDb(vendors, [product("p1", "v1", 0)]);
    const store = await loadFullStore(source, T0);

    vendors.push(vendor("v2", CURSOR_MARGIN_MS + 1000));
    await syncStore(source, store, T0 + 60_000);

    expect(ids(storeToRows(store).vendors)).toEqual(["v1"]);
  });

  it("論理削除された商品を落とす（updated_at では見えないので、削除 id の一覧で知る）", async () => {
    const products = [product("p1", "v1", 0), product("p2", "v1", 0)];
    const { source } = fakeDb([vendor("v1", 0)], products);
    const store = await loadFullStore(source, T0);

    products[0] = { ...products[0], deleted: true, updated_at: at(60_000) };
    const next = await syncStore(source, store, T0 + 120_000);

    expect(ids(storeToRows(next).products)).toEqual(["p2"]);
  });

  it("掲載の許可を取り下げた店舗と、その商品を、数の食い違いで検知して落とす", async () => {
    const vendors = [vendor("v1", 0), vendor("v2", 0)];
    const { source, calls } = fakeDb(vendors, [product("p1", "v1", 0), product("p2", "v2", 0)]);
    const store = await loadFullStore(source, T0);

    // 来訪者からは行ごと見えなくなるので、変更としては届かない
    vendors[1] = { ...vendors[1], visible: false, updated_at: at(60_000) };
    const next = await syncStore(source, store, T0 + 120_000);

    expect(calls.visibleVendorIds).toBe(1);
    expect(ids(storeToRows(next).vendors)).toEqual(["v1"]);
    expect(ids(storeToRows(next).products)).toEqual(["p1"]);
  });

  it("削除された店舗の商品は、その店舗と一緒に落とす", async () => {
    const vendors = [vendor("v1", 0), vendor("v2", 0)];
    const products = [product("p1", "v1", 0), product("p2", "v2", 0)];
    const { source } = fakeDb(vendors, products);
    const store = await loadFullStore(source, T0);

    vendors.splice(1, 1);
    products.splice(1, 1);
    const next = await syncStore(source, store, T0 + 120_000);

    expect(ids(storeToRows(next).vendors)).toEqual(["v1"]);
    expect(ids(storeToRows(next).products)).toEqual(["p1"]);
  });

  it("数が合っていれば、一定間隔までは id の一覧を取らない。間隔が過ぎたら取る", async () => {
    const { source, calls } = fakeDb([vendor("v1", 0)], []);
    const store = await loadFullStore(source, T0);

    const next = await syncStore(source, store, T0 + 60_000);
    expect(calls.visibleVendorIds).toBe(0);

    await syncStore(source, next, T0 + ID_CHECK_INTERVAL_MS);
    expect(calls.visibleVendorIds).toBe(1);
  });

  it("forceIdCheck のときは、数が合っていても id の一覧で突き合わせる", async () => {
    const { source, calls } = fakeDb([vendor("v1", 0)], []);
    const store = await loadFullStore(source, T0);

    await syncStore(source, store, T0 + 1000, { forceIdCheck: true });
    expect(calls.visibleVendorIds).toBe(1);
  });

  it("新しく見えるようになった店舗は、商品が古いままでも、商品を全件取る", async () => {
    // 掲載の許可を受ける前の店舗。商品は大昔に登録したまま（updated_at が基準より古い）
    const vendors = [vendor("v1", 0), vendor("v2", -86_400_000, { visible: false })];
    const products = [product("p1", "v1", 0), product("p2", "v2", -86_400_000)];
    const { source, calls } = fakeDb(vendors, products);
    const store = await loadFullStore(source, T0);
    expect(ids(storeToRows(store).products)).toEqual(["p1"]);

    vendors[1] = { ...vendors[1], visible: true, updated_at: at(CURSOR_MARGIN_MS + 1000) };
    const next = await syncStore(source, store, T0 + CURSOR_MARGIN_MS + 2000);

    expect(calls.productsByVendorIds).toEqual([["v2"]]);
    expect(ids(storeToRows(next).vendors)).toEqual(["v1", "v2"]);
    expect(ids(storeToRows(next).products)).toEqual(["p1", "p2"]);
  });

  it("変更として届かなかった店舗も、id の突き合わせで見つけて取り込む", async () => {
    const vendors = [vendor("v1", 0)];
    const { source } = fakeDb(vendors, [product("p9", "v2", -86_400_000)]);
    const store = await loadFullStore(source, T0);

    // 古い updated_at のまま、あとから見えるようになった（差分にも載らない）店舗
    vendors.push(vendor("v2", -86_400_000));
    const next = await syncStore(source, store, T0 + 60_000);

    expect(ids(storeToRows(next).vendors)).toEqual(["v1", "v2"]);
    expect(ids(storeToRows(next).products)).toEqual(["p9"]);
  });

  it("基準より少し前から取り直すので、遅れてコミットされた更新も拾う", async () => {
    const vendors = [vendor("v1", 10 * 60_000)];
    const { source } = fakeDb(vendors, []);
    const store = await loadFullStore(source, T0);

    // 基準（10 分）より 1 分前の updated_at を持つ行が、あとからコミットされた
    vendors.push(vendor("v2", 9 * 60_000));
    const next = await syncStore(source, store, T0 + 11 * 60_000);

    expect(ids(storeToRows(next).vendors)).toEqual(["v1", "v2"]);
  });

  it("取得に失敗したら例外にする（呼び出し側が前回のデータを使い続ける）", async () => {
    const { source } = fakeDb([vendor("v1", 0)], []);
    const store = await loadFullStore(source, T0);

    await expect(
      syncStore({ ...source, changedProducts: async () => { throw new Error("down"); } }, store, T0 + 60_000)
    ).rejects.toThrow("down");
  });
});
