import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const fetchShopMembership = vi.fn();
// vi.mock の工場関数（巻き上げられる）から使うので、vi.hoisted で先に作る
const { FakeLookupError } = vi.hoisted(() => ({ FakeLookupError: class extends Error {} }));

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: () => getUser() } }),
}));
vi.mock("./shopMembership", () => ({
  fetchShopMembership: (...args: unknown[]) => fetchShopMembership(...args),
  ShopMembershipLookupError: FakeLookupError,
}));

import { requireVendorContext } from "./shopContext.server";

const VENDOR = { id: "user-1", app_metadata: { role: "vendor" } };
const member = (permissions: string[], role = "member") => ({ vendorId: "shop-1", role, permissions, joinedAt: null });

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: VENDOR } });
  fetchShopMembership.mockResolvedValue(member(["post"]));
});

async function status(options?: Parameters<typeof requireVendorContext>[0]) {
  const result = await requireVendorContext(options);
  return result.ok ? 200 : result.response.status;
}

describe("requireVendorContext", () => {
  it("店舗の ID は user.id ではなく所属店舗から返す", async () => {
    const result = await requireVendorContext();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.vendorId).toBe("shop-1");
      expect(result.user.id).toBe("user-1");
    }
    expect(fetchShopMembership).toHaveBeenCalledWith(expect.anything(), "user-1");
  });

  it("ログインしていなければ 401（所属は引かない）", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect(await status()).toBe(401);
    expect(fetchShopMembership).not.toHaveBeenCalled();
  });

  it("出店者ロールでなければ 403", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u", app_metadata: { role: "general_user" } } } });

    expect(await status()).toBe(403);
  });

  it("出店者ロールでも、店舗に入っていなければ 403", async () => {
    fetchShopMembership.mockResolvedValue(null);

    expect(await status()).toBe(403);
  });

  it("所属を引く通信が失敗したときは、「店舗に紐づいていません」(403) ではなく 503 で、もう一度試せるようにする", async () => {
    fetchShopMembership.mockRejectedValue(new FakeLookupError("network"));

    expect(await status()).toBe(503);
  });

  it("想定外のエラーはそのまま投げる（握りつぶさない）", async () => {
    fetchShopMembership.mockRejectedValue(new Error("bug"));

    await expect(requireVendorContext()).rejects.toThrow("bug");
  });

  it("権限を指定したら、メンバーはその権限があるときだけ通る", async () => {
    expect(await status({ permission: "post" })).toBe(200);
    expect(await status({ permission: "store_edit" })).toBe(403);
  });

  it("代表者は権限の中身にかかわらず通る", async () => {
    fetchShopMembership.mockResolvedValue(member([], "owner"));

    expect(await status({ permission: "members_manage" })).toBe(200);
  });
});
