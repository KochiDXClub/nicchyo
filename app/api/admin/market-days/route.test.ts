import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, maybeSingle, saveMarketDay } = vi.hoisted(() => ({
  from: vi.fn(),
  maybeSingle: vi.fn(),
  saveMarketDay: vi.fn(),
}));

vi.mock("@/lib/supabase/adminClient", () => ({ createAdminClient: () => ({ from }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("../events/_helpers", () => ({
  authorizeAdmin: async () => ({ user: { id: "operator", app_metadata: { role: "admin" } } }),
}));
vi.mock("@/lib/market/saveMarketDay.server", () => ({ saveMarketDay, readDefaultMarketId: vi.fn() }));

import { GET, PUT } from "./route";

const url = "https://example.test/api/admin/market-days";
const marketId = "a1234567-abcd-1234-abcd-123456789abc";

function save(marketDate: string, status: string, market_id = marketId) {
  return PUT(new Request(url, {
    method: "PUT",
    headers: { origin: new URL(url).origin, "Content-Type": "application/json" },
    body: JSON.stringify({ market_id, market_date: marketDate, status }),
  }));
}

describe("管理者の市別開催状況", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: { weekday: 4 }, error: null });
    from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) });
    saveMarketDay.mockResolvedValue({ day: {} });
  });

  it.each(["", "not-a-uuid"])("無効な市ID %j をDBへ渡さない", async (id) => {
    expect((await GET(new Request(`${url}?market_id=${id}`))).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("指定された市が存在しなければ保存しない", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await save("2026-11-19", "open")).status).toBe(404);
    expect(saveMarketDay).not.toHaveBeenCalled();
  });

  it("通常と異なる曜日に通常開催・中止を登録しない", async () => {
    expect((await save("2026-11-22", "open")).status).toBe(400);
    expect((await save("2026-11-22", "cancelled")).status).toBe(400);
    expect(saveMarketDay).not.toHaveBeenCalled();
  });

  it("通常の開催曜日と、別曜日の特別開催を受け付ける", async () => {
    expect((await save("2026-11-19", "open")).status).toBe(200);
    expect((await save("2026-11-22", "special")).status).toBe(200);
    expect(saveMarketDay).toHaveBeenCalledTimes(2);
  });
});
