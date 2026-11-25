// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const inserted = vi.fn();
const deleted = vi.fn();
/** 商品の持ち主の確認に使う。null なら「自店の商品が無い」 */
let ownedProduct: { id: string } | null = null;

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/vendor/shopContext.server", () => ({
  requireVendorContext: async () => ({ ok: true, vendorId: "shop-1" }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "products") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: ownedProduct, error: null }) }) }),
          }),
        };
      }
      return {
        delete: () => ({
          eq: async (_col: string, id: string) => (deleted(id), { error: null }),
        }),
        insert: async (rows: unknown) => (inserted(rows), { error: null }),
      };
    },
  }),
}));

import { POST } from "./route";

const UUID = "11111111-1111-4111-8111-111111111111";
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/vendor/product-seasons", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("POST /api/vendor/product-seasons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    ownedProduct = { id: UUID };
  });

  it("自店の商品なら、旬を置き換えて保存する", async () => {
    const res = await post({ productId: UUID, seasons: ["spring_summer", "winter_spring"] });
    expect(res.status).toBe(200);
    expect(deleted).toHaveBeenCalledWith(UUID);
    expect(inserted).toHaveBeenCalledWith([
      { product_id: UUID, season_id: 0 },
      { product_id: UUID, season_id: 3 },
    ]);
  });

  it("旬を全部外したときは、消すだけで挿入しない", async () => {
    const res = await post({ productId: UUID, seasons: [] });
    expect(res.status).toBe(200);
    expect(deleted).toHaveBeenCalledWith(UUID);
    expect(inserted).not.toHaveBeenCalled();
  });

  it("他店の商品（自店のものとして見つからない）には旬を付けられない", async () => {
    ownedProduct = null;
    const res = await post({ productId: UUID, seasons: ["summer_autumn"] });
    expect(res.status).toBe(404);
    expect(deleted).not.toHaveBeenCalled();
    expect(inserted).not.toHaveBeenCalled();
  });

  it("不正な旬や同じ旬の重ねを弾く", async () => {
    expect((await post({ productId: UUID, seasons: ["unknown"] })).status).toBe(400);
    expect((await post({ productId: UUID, seasons: ["summer_autumn", "summer_autumn"] })).status).toBe(400);
    expect(deleted).not.toHaveBeenCalled();
  });
});
