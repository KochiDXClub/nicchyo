import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseStorageUrl, ownProductImagePath, purgeRemovedProducts } from "./productImages";

const deletes: string[] = [];
const storageRemove = vi.fn();
let rows: { id: string; name: string; image_url: string | null }[];
let signature: string | null;

const client = {
  from: (table: string) => {
    if (table === "vendors") {
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { signature_product_name: signature }, error: null }) }) }) };
    }
    return {
      select: () => ({ eq: async () => ({ data: rows, error: null }) }),
      delete: () => {
        const filters: string[] = [];
        const chain = {
          eq: (column: string, value: string) => {
            filters.push(`${column}=${value}`);
            if (column === "vendor_id") {
              deletes.push(filters.join(","));
              return Promise.resolve({ error: null });
            }
            return chain;
          },
        };
        return chain;
      },
    };
  },
  storage: {
    from: () => ({
      list: async () => ({ data: [{ name: "product-p2.webp" }, { name: "product-p3.webp" }] }),
      remove: (...args: unknown[]) => storageRemove(...args),
    }),
  },
} as unknown as SupabaseClient;

beforeEach(() => {
  deletes.length = 0;
  storageRemove.mockReset();
  storageRemove.mockResolvedValue({ error: null });
  signature = null;
  rows = [
    { id: "p1", name: "トマト", image_url: null },
    { id: "p2", name: "なす", image_url: null },
    { id: "p3", name: "看板の柿", image_url: null },
    { id: "p4", name: "昔の商品", image_url: null },
  ];
});

describe("purgeRemovedProducts", () => {
  it("一覧から外した商品の行と写真を消す。看板商品と、画面に出ていなかった行は残す", async () => {
    signature = "看板の柿";
    await purgeRemovedProducts(client, "v1", ["トマト", "なす", "看板の柿"], ["トマト"]);

    expect(deletes).toEqual(["id=p2,vendor_id=v1"]);
    expect(storageRemove).toHaveBeenCalledWith(["v1/product-p2.webp"]);
  });

  it("主な商品が空だったときは、画面には何も出ていなかったので、何も消さない（products にだけある商品の行を守る）", async () => {
    await purgeRemovedProducts(client, "v1", [], []);
    await purgeRemovedProducts(client, "v1", [], ["トマト"]);
    expect(deletes).toEqual([]);
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("読めなくても投げない（一覧の保存は済んでいる）", async () => {
    const broken = { from: () => { throw new Error("down"); } } as unknown as SupabaseClient;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(purgeRemovedProducts(broken, "v1", ["a"], [])).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe("ownProductImagePath", () => {
  const base = "https://x.supabase.co/storage/v1/object/public/vendor-images";

  it("自店舗のフォルダ直下の商品写真だけ、パスを取り出す（版のクエリは外す）", () => {
    expect(ownProductImagePath(`${base}/v1/product-ab12-cd.webp?v=170`, "v1")).toBe("v1/product-ab12-cd.webp");
  });

  it("他店舗・深い階層・商品写真でないファイル・パスの細工・壊れた URL は null", () => {
    expect(ownProductImagePath(`${base}/v2/product-ab12.webp`, "v1")).toBeNull();
    expect(ownProductImagePath(`${base}/v1/sub/product-ab12.webp`, "v1")).toBeNull();
    expect(ownProductImagePath(`${base}/v1/store-main.webp`, "v1")).toBeNull();
    expect(ownProductImagePath(`${base}/v1%2F..%2Fv2%2Fproduct-ab12.webp`, "v1")).toBeNull();
    expect(ownProductImagePath(`${base}/v1/%E0%A4%A`, "v1")).toBeNull();
    expect(ownProductImagePath("https://example.com/a.webp", "v1")).toBeNull();
    expect(ownProductImagePath(null, "v1")).toBeNull();
  });
});

describe("isSupabaseStorageUrl", () => {
  it("*.supabase.co の https の Storage URL だけ通す", () => {
    expect(isSupabaseStorageUrl("https://x.supabase.co/storage/v1/object/public/vendor-images/a.webp")).toBe(true);
    expect(isSupabaseStorageUrl("https://evil.example.com/storage/a.webp")).toBe(false);
    expect(isSupabaseStorageUrl("http://x.supabase.co/storage/a.webp")).toBe(false);
    expect(isSupabaseStorageUrl("https://x.supabase.co.evil.com/storage/a.webp")).toBe(false);
    expect(isSupabaseStorageUrl("javascript:alert(1)")).toBe(false);
  });
});
