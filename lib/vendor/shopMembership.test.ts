import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchShopMembership, isShopMember, ShopMembershipLookupError } from "./shopMembership";

/** from().select().eq()…maybeSingle() の最後で、決めた結果を返す */
function clientReturning(result: { data: unknown; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = async () => result;
  return { from: () => chain } as unknown as SupabaseClient;
}

describe("fetchShopMembership", () => {
  it("所属があれば、店舗の ID・立場・権限を返す（知らない権限キーは捨てる）", async () => {
    const client = clientReturning({
      data: { vendor_id: "shop-1", role: "member", permissions: ["post", "root"], created_at: "2026-10-01T00:00:00Z" },
      error: null,
    });

    expect(await fetchShopMembership(client, "user-1")).toEqual({
      vendorId: "shop-1",
      role: "member",
      permissions: ["post"],
      joinedAt: "2026-10-01T00:00:00Z",
    });
  });

  it("所属がなければ null", async () => {
    expect(await fetchShopMembership(clientReturning({ data: null, error: null }), "user-1")).toBeNull();
  });

  it("通信などで引けなかったときは、「所属なし」(null) ではなく専用のエラーを投げる", async () => {
    const client = clientReturning({ data: null, error: { message: "network" } });

    await expect(fetchShopMembership(client, "user-1")).rejects.toBeInstanceOf(ShopMembershipLookupError);
  });
});

describe("isShopMember", () => {
  it("メンバーなら true、そうでなければ false、調べられなかったときは false（数える側に倒す）", async () => {
    expect(await isShopMember(clientReturning({ data: { user_id: "u" }, error: null }), "u", "shop-1")).toBe(true);
    expect(await isShopMember(clientReturning({ data: null, error: null }), "u", "shop-1")).toBe(false);
    expect(await isShopMember(clientReturning({ data: null, error: { message: "x" } }), "u", "shop-1")).toBe(false);
  });
});
