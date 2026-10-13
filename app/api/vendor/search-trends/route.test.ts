import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireVendorContext = vi.fn();
const createAdminClient = vi.fn();
let rows: { keyword: string }[] = [];

vi.mock("@/lib/vendor/shopContext.server", () => ({
  requireVendorContext: (...args: unknown[]) => requireVendorContext(...args),
}));
vi.mock("@/lib/supabase/adminClient", () => ({ createAdminClient: () => createAdminClient() }));

import { GET } from "./route";

function fakeAdmin() {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.gte = () => chain;
  chain.order = () => chain;
  chain.limit = () => chain;
  chain.then = (resolve: (value: unknown) => void) => resolve({ data: rows, error: null });
  return { from: () => chain };
}

beforeEach(() => {
  vi.clearAllMocks();
  rows = [];
  createAdminClient.mockReturnValue(fakeAdmin());
  requireVendorContext.mockResolvedValue({ ok: true, user: { id: "u" }, vendorId: "shop-1", membership: {}, supabase: {} });
});

describe("GET /api/vendor/search-trends", () => {
  it("分析の閲覧の権限で呼び、語と回数の集計だけを上位10件返す", async () => {
    // 12語を2回ずつ＋トマトを3回（1回だけの語は出さないので、どれも2回以上にしておく）
    rows = [
      ...Array.from({ length: 12 }, (_, i) => `語${String(i).padStart(2, "0")}`).flatMap((keyword) => [
        { keyword },
        { keyword },
      ]),
      { keyword: "トマト" },
      { keyword: "トマト" },
      { keyword: "トマト" },
    ];

    const body = await (await GET()).json();

    expect(requireVendorContext).toHaveBeenCalledWith({ permission: "analytics" });
    expect(body.keywords).toHaveLength(10);
    expect(body.keywords[0]).toEqual({ keyword: "トマト", count: 3 });
    // 生の行（searched_at など）は返さない
    expect(Object.keys(body.keywords[0])).toEqual(["keyword", "count"]);
  });

  it("出店者でない・権限が無いときは、その応答をそのまま返す", async () => {
    requireVendorContext.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "この操作をする権限がありません" }, { status: 403 }),
    });

    const res = await GET();

    expect(res.status).toBe(403);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("service role が使えないときは 503", async () => {
    createAdminClient.mockReturnValue(null);

    expect((await GET()).status).toBe(503);
  });
});
