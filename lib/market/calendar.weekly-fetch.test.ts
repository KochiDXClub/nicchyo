import { describe, expect, it } from "vitest";
import { fetchMarketCalendar, groupEventsBySunday } from "./calendar";

describe("fetchMarketCalendar", () => {
  it("週の途中でもその週の月曜に終わった予定を日曜カードに表示する", async () => {
    const event = { id: "event", title: "予定", description: null, event_date: "2026-08-10", end_date: null, start_time: null, end_time: null, location: null, category: "event", image_url: null, highlight_dates: [] };
    let filter = "";
    const client = { from(table: string) {
      const query = {
        select: () => query, gte: () => query, eq: () => query, order: () => query,
        or: (value: string) => { filter = value; return query; },
        limit: async () => ({ data: table === "market_days" ? [] : (filter.includes("event_date.gte.2026-08-10") ? [event] : []), error: null }),
      };
      return query;
    } };
    const now = new Date("2026-08-11T03:00:00Z");
    const calendar = await fetchMarketCalendar(client as never, { now });
    expect(filter).toContain("end_date.gte.2026-08-10");
    expect(groupEventsBySunday(calendar.events, [], 1, now)[0].events.map((e) => e.id)).toEqual(["event"]);
  });
});
