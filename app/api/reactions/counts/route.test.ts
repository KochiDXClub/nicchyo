import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
import { GET } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const url = (query: string) => new Request(`https://example.test/api/reactions/counts?${query}`);

it("訪問者のハート済み取得は件数の集計を待たずに同時に始める", async () => {
  // 件数の集計は、ハート済みの問い合わせが始まるまで結果を返さない（直列なら待ち続けて失敗する）
  let markReactedStarted!: () => void;
  const reactedStarted = new Promise<void>((resolve) => (markReactedStarted = resolve));
  mocks.rpc.mockImplementation(async () => {
    await reactedStarted;
    return { data: [{ vendor_content_id: ID, cnt: 2 }], error: null };
  });
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.in = () => {
    markReactedStarted();
    return Promise.resolve({ data: [{ vendor_content_id: ID }], error: null });
  };
  mocks.from.mockReturnValue(chain);

  const response = await Promise.race([
    GET(url(`ids=${ID}&visitorKey=vk`)),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("直列に待っている")), 1000)),
  ]);
  expect(await response.json()).toEqual({ counts: { [ID]: 2 }, reactedIds: [ID] });
});

it("visitorKey が無いときは、ハート済みの問い合わせをしない", async () => {
  mocks.from.mockClear();
  mocks.rpc.mockResolvedValue({ data: [{ vendor_content_id: ID, cnt: 5 }], error: null });
  const response = await GET(url(`ids=${ID}`));
  expect(await response.json()).toEqual({ counts: { [ID]: 5 }, reactedIds: [] });
  expect(mocks.from).not.toHaveBeenCalled();
});
