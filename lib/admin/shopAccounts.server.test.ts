import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadShopAccountLinks } from "./shopAccounts.server";

function client(result: { data: unknown; error: { message: string } | null }) {
  const calls: { ids?: string[] } = {};
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.in = (_col: string, ids: string[]) => {
    calls.ids = ids;
    return chain;
  };
  chain.then = (resolve: (value: unknown) => void) => resolve(result);
  return { db: { from: () => chain } as unknown as SupabaseClient, calls };
}

describe("loadShopAccountLinks", () => {
  it("店舗ごとの代表者・メンバーと、アカウントごとの店舗を引く。アカウントのない店舗は、どこにも入らない", async () => {
    const { db } = client({
      data: [
        { vendor_id: "shop-a", user_id: "u1", role: "owner" },
        { vendor_id: "shop-a", user_id: "u2", role: "member" },
        { vendor_id: "shop-b", user_id: "u3", role: "owner" },
      ],
      error: null,
    });

    const { links, error } = await loadShopAccountLinks(db);

    expect(error).toBeNull();
    expect(links.ownerByVendor.get("shop-a")).toBe("u1");
    expect(links.membersByVendor.get("shop-a")).toEqual(["u1", "u2"]);
    expect(links.vendorByUser.get("u2")).toBe("shop-a");
    expect(links.ownerByVendor.has("shop-c")).toBe(false);
    expect(links.membersByVendor.has("shop-c")).toBe(false);
  });

  it("店舗を指定したら、その店舗だけを引く", async () => {
    const { db, calls } = client({ data: [], error: null });

    await loadShopAccountLinks(db, ["shop-a", "shop-b"]);

    expect(calls.ids).toEqual(["shop-a", "shop-b"]);
  });

  it("引けなかったときは、空の対応と理由を返す（呼び出し側で止めるか決める）", async () => {
    const { db } = client({ data: null, error: { message: "boom" } });

    const { links, error } = await loadShopAccountLinks(db);

    expect(error).toBe("boom");
    expect(links.membersByVendor.size).toBe(0);
  });
});
