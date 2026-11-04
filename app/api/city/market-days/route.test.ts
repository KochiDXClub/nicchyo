// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireCityApi = vi.fn();
const saveMarketDay = vi.fn();

vi.mock("@/lib/auth/requireCityApi", () => ({ requireCityApi: () => requireCityApi() }));
vi.mock("@/lib/market/saveMarketDay.server", () => ({
  saveMarketDay: (...args: unknown[]) => saveMarketDay(...args),
}));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));

import { PUT } from "./route";

const unauthorized = { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) };
const ctx = {
  user: { id: "u1", email: "city@example.com" },
  role: "city_official",
  adminClient: {},
};

const put = (body: unknown) =>
  PUT(new Request("http://localhost/api/city/market-days", { method: "PUT", body: JSON.stringify(body) }));

beforeEach(() => {
  // 「今日」を固定する（JST の 2026-11-03 火曜）。日付の範囲チェックが実時間に依存しないように
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T03:00:00Z"));
  requireCityApi.mockReset();
  saveMarketDay.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PUT /api/city/market-days", () => {
  it("権限がなければ 401 で何も保存しない", async () => {
    requireCityApi.mockResolvedValue(unauthorized);
    const res = await put({ market_date: "2026-11-08", status: "cancelled" });
    expect(res.status).toBe(401);
    expect(saveMarketDay).not.toHaveBeenCalled();
  });

  it("不正な入力は 400 で保存しない", async () => {
    requireCityApi.mockResolvedValue(ctx);
    const res = await put({ market_date: "2026-02-31", status: "cancelled" });
    expect(res.status).toBe(400);
    expect(saveMarketDay).not.toHaveBeenCalled();
  });

  it("過去・日曜以外・遠い先の日付は 400 で保存しない", async () => {
    requireCityApi.mockResolvedValue(ctx);
    for (const market_date of ["2026-11-01", "2026-11-09", "2027-03-07"]) {
      const res = await put({ market_date, status: "cancelled" });
      expect(res.status).toBe(400);
    }
    expect(saveMarketDay).not.toHaveBeenCalled();
  });

  it("保存は actor.role に city_official を載せ、updated_by を返さない", async () => {
    requireCityApi.mockResolvedValue(ctx);
    saveMarketDay.mockResolvedValue({
      day: {
        market_date: "2026-11-08",
        status: "cancelled",
        note: "雨天中止",
        updated_by: "u1",
        created_at: "x",
        updated_at: "2026-11-07T00:00:00Z",
      },
    });
    const res = await put({ market_date: "2026-11-08", status: "cancelled", note: "雨天中止" });
    expect(res.status).toBe(200);
    expect(saveMarketDay.mock.calls[0][1]).toEqual({
      id: "u1",
      email: "city@example.com",
      role: "city_official",
    });
    expect(await res.json()).toEqual({
      day: {
        market_date: "2026-11-08",
        status: "cancelled",
        note: "雨天中止",
        updated_at: "2026-11-07T00:00:00Z",
      },
    });
  });

  it("保存に失敗したら 500", async () => {
    requireCityApi.mockResolvedValue(ctx);
    saveMarketDay.mockResolvedValue({ error: "保存に失敗しました" });
    const res = await put({ market_date: "2026-11-08", status: "open" });
    expect(res.status).toBe(500);
  });
});
