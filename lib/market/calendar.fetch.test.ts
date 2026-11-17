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
  it("未登録の場合は通常の空の結果を返す", async () => {
    const client = { from() {
      const query = { select: () => query, gte: () => query, eq: () => query, order: () => query, or: () => query, limit: async () => ({ data: [], error: null }) };
      return query;
    } };
    expect(await fetchMarketCalendar(client as never)).toEqual({ day: null, days: [], events: [] });
  });
});
