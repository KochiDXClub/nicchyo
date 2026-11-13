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

it("出店しない週も公開店舗の近況に固定店舗 ID を付ける", async () => {
  mocks.rollout.mockResolvedValue(true);
  mocks.profiles.mockResolvedValue([{ id: 1001, vendorId: "v1", hasMapLocation: false }]);
  mocks.limit.mockResolvedValue({ data: [{ id: "post", vendor: { id: "v1", shop_name: "八百屋", shop_image_url: null } }], error: null });
  const response = await GET();
  expect(await response.json()).toEqual([expect.objectContaining({ vendor: expect.objectContaining({ store_number: 1001 }) })]);
});
