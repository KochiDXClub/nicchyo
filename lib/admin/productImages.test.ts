import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { purgeRemovedProducts } from "./productImages";

const deletes: string[] = [];
const storageRemove = vi.fn();
let rows: { id: string; name: string }[];
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
    { id: "p1", name: "トマト" },
    { id: "p2", name: "なす" },
    { id: "p3", name: "看板の柿" },
    { id: "p4", name: "昔の商品" },
  ];
});

describe("purgeRemovedProducts", () => {
  it("一覧から外した商品の行と写真を消す。看板商品と、画面に出ていなかった行は残す", async () => {
    signature = "看板の柿";
    await purgeRemovedProducts(client, "v1", ["トマト", "なす", "看板の柿"], ["トマト"]);

    expect(deletes).toEqual(["id=p2,vendor_id=v1"]);
    expect(storageRemove).toHaveBeenCalledWith(["v1/product-p2.webp"]);
  });

  it("主な商品が空だったときは、products の商品が画面に出ていたものとして扱う", async () => {
    await purgeRemovedProducts(client, "v1", [], ["トマト"]);
    expect(deletes).toEqual(["id=p2,vendor_id=v1", "id=p3,vendor_id=v1", "id=p4,vendor_id=v1"]);
  });

  it("読めなくても投げない（一覧の保存は済んでいる）", async () => {
    const broken = { from: () => { throw new Error("down"); } } as unknown as SupabaseClient;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(purgeRemovedProducts(broken, "v1", ["a"], [])).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
