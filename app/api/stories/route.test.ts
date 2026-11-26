import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ profiles: vi.fn(), rollout: vi.fn(), limit: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/market-schedule/rollout.server", () => ({ readPublicScheduleRollout: mocks.rollout }));
vi.mock("@/app/(public)/map/services/shopCache", () => ({ fetchPublicShopProfiles: mocks.profiles }));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => {
  const query = { select: () => query, eq: () => query, not: () => query, gte: () => query, order: () => query, limit: mocks.limit };
  return { from: () => query };
} }));
import { GET } from "./route";

it("公開切替の読み取りは投稿の取得を待たずに始める", async () => {
  // 投稿の取得は、公開切替の読み取りが始まるまで結果を返さない（直列なら待ち続けて失敗する）
  let markRolloutStarted!: () => void;
  const rolloutStarted = new Promise<void>((resolve) => (markRolloutStarted = resolve));
  mocks.rollout.mockImplementation(async () => {
    markRolloutStarted();
    return false;
  });
  mocks.limit.mockImplementation(async () => {
    await rolloutStarted;
    return { data: [], error: null };
  });
  const response = await Promise.race([
    GET(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("直列に待っている")), 1000)),
  ]);
  expect(await response.json()).toEqual([]);
});

it("出店しない週も公開店舗の近況に固定店舗 ID を付ける", async () => {
  mocks.rollout.mockResolvedValue(true);
  mocks.profiles.mockResolvedValue([{ id: 1001, vendorId: "v1", hasMapLocation: false }]);
  mocks.limit.mockResolvedValue({ data: [{ id: "post", vendor: { id: "v1", shop_name: "八百屋", shop_image_url: null } }], error: null });
  const response = await GET();
  expect(await response.json()).toEqual([expect.objectContaining({ vendor: expect.objectContaining({ store_number: 1001 }) })]);
});
