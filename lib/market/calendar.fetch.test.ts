import { describe, expect, it } from "vitest";
import { fetchMarketCalendar } from "./calendar";

describe("fetchMarketCalendar", () => {
  it.each(["market_days", "market_events"])("%s の取得エラーを空の結果として扱わない", async (failedTable) => {
    const client = { from(table: string) {
      const query = {
        select: () => query, gte: () => query, eq: () => query, order: () => query, or: () => query,
        limit: async () => table === failedTable ? { data: null, error: { message: "unavailable" } } : { data: [], error: null },
      };
      return query;
    } };
    await expect(fetchMarketCalendar(client as never)).rejects.toThrow("開催情報を取得できませんでした");
  });
  it("公開用の取得で開催情報の更新日時を返す", async () => {
    const day = {
      market_date: "2026-11-22",
      status: "cancelled",
      note: "荒天のため",
      updated_at: "2026-11-18T04:15:00Z",
    };
    const client = { from(table: string) {
      const query = {
        select: (columns: string) => {
          if (table === "market_days") expect(columns.split(", ")).toContain("updated_at");
          return query;
        },
        gte: () => query, eq: () => query, order: () => query, or: () => query,
        limit: async () => ({ data: table === "market_days" ? [day] : [], error: null }),
      };
      return query;
    } };
    const now = new Date("2026-11-18T04:30:00Z");
    await expect(fetchMarketCalendar(client as never, { now })).resolves.toMatchObject({ day });
  });

  it("未登録の場合は通常の空の結果を返す", async () => {
    const client = { from() {
      const query = { select: () => query, gte: () => query, eq: () => query, order: () => query, or: () => query, limit: async () => ({ data: [], error: null }) };
      return query;
    } };
    expect(await fetchMarketCalendar(client as never)).toEqual({ day: null, days: [], events: [] });
  });
});
