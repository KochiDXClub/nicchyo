import { describe, expect, it } from "vitest";
import { fetchMarketCalendar } from "./calendar.server";
import { getMarketCalendarDates } from "./calendar";

const sunday = { id: "sun", slug: "nichiyo", name: "日曜市", weekday: 0, is_public: true };
const thursday = { id: "thu", slug: "mokuyo", name: "木曜市", weekday: 4, is_public: true };
const now = new Date("2026-08-11T03:00:00Z");
const event = (id: string, market_id: string, event_date: string) => ({
  id, market_id, event_date, title: id, description: null, end_date: null, start_time: null,
  end_time: null, location: null, category: "event", image_url: null, highlight_dates: [],
});

function fakeClient(raw: Record<string, Record<string, unknown>[]>, failedTable?: string) {
  const calls: [string, string, ...unknown[]][] = [];
  const client = { from(table: string) {
    let rows = raw[table] ?? [];
    const query = {
      select(columns: string) { calls.push([table, "select", columns]); return query; },
      eq(column: string, value: unknown) {
        calls.push([table, "eq", column, value]);
        if (column === "is_public") rows = rows.filter((row) => row[column] === value);
        return query;
      },
      in(column: string, values: unknown[]) {
        calls.push([table, "in", column, values]);
        rows = rows.filter((row) => values.includes(row[column]));
        return query;
      },
      gte(column: string, value: string) { calls.push([table, "gte", column, value]); return query; },
      lte() { return query; },
      or(filter: string) { calls.push([table, "or", filter]); return query; },
      order() { return query; },
      limit() { return query; },
      then(resolve: (value: { data: typeof rows | null; error: unknown }) => unknown) {
        return Promise.resolve(resolve(table === failedTable ? { data: null, error: new Error("unavailable") } : { data: rows, error: null }));
      },
    };
    return query;
  } };
  return { client: client as never, calls };
}

describe("fetchMarketCalendar", () => {
  it.each(["markets", "market_days", "market_events"])("%s の取得エラーを空の結果として扱わない", async (failedTable) => {
    const { client } = fakeClient({ markets: [sunday] }, failedTable);
    await expect(fetchMarketCalendar(client, { now })).rejects.toThrow();
  });

  it("公開中の市がないときは、予定を取得せずに空の結果を返す", async () => {
    const { client, calls } = fakeClient({ markets: [{ ...thursday, is_public: false }] });
    expect(await fetchMarketCalendar(client, { now })).toEqual({ todayIso: "2026-08-11", markets: [] });
    expect(calls.every(([table]) => table === "markets")).toBe(true);
  });

  it("公開用の開催情報には更新日時を含める", async () => {
    const day = { market_id: "sun", market_date: "2026-08-16", status: "cancelled", note: "荒天", updated_at: "2026-08-11T04:15:00Z" };
    const { client, calls } = fakeClient({ markets: [sunday], market_days: [day] });
    const result = await fetchMarketCalendar(client, { now });
    expect(result.markets[0].days).toEqual([{ market_date: day.market_date, status: day.status, note: day.note, updated_at: day.updated_at }]);
    expect(calls).toContainEqual(["market_days", "select", expect.stringContaining("updated_at")]);
  });

  it("非公開の市の開催状況やイベントを含めない", async () => {
    const { client, calls } = fakeClient({
      markets: [sunday, { ...thursday, is_public: false }],
      market_days: [{ market_id: "thu", market_date: "2026-08-13", status: "cancelled", note: null }],
      market_events: [event("hidden", "thu", "2026-08-13"), event("sunday", "sun", "2026-08-16")],
    });
    const result = await fetchMarketCalendar(client, { now });
    expect(result.markets.map(({ id }) => id)).toEqual(["sun"]);
    expect(result.markets[0].days).toEqual([]);
    expect(result.markets[0].events.map(({ id }) => id)).toEqual(["sunday"]);
    for (const table of ["market_days", "market_events"]) {
      expect(calls).toContainEqual([table, "in", "market_id", ["sun"]]);
      expect(calls).toContainEqual([table, "eq", "markets.is_public", true]);
    }
  });

  it("同じ日付の開催状況・イベントを市IDごとに分ける", async () => {
    const { client } = fakeClient({
      markets: [sunday, thursday],
      market_days: [
        { market_id: "sun", market_date: "2026-08-13", status: "special", note: null },
        { market_id: "thu", market_date: "2026-08-13", status: "cancelled", note: "荒天" },
      ],
      market_events: [event("thursday", "thu", "2026-08-13")],
    });
    const dates = getMarketCalendarDates(await fetchMarketCalendar(client, { now }), 1);
    expect(dates.filter(({ dateIso }) => dateIso === "2026-08-13")).toMatchObject([
      { marketName: "日曜市", status: "special", events: [] },
      { marketName: "木曜市", status: "cancelled", events: [{ id: "thursday" }] },
    ]);
  });

  it("日曜市だけの場合は、月曜に終わった旧予定を引き続きその週の日曜カードに載せる", async () => {
    const { client, calls } = fakeClient({ markets: [sunday], market_events: [event("legacy", "sun", "2026-08-10")] });
    const calendar = await fetchMarketCalendar(client, { now });
    expect(calls.find(([table, method]) => table === "market_events" && method === "or")?.[2]).toContain("end_date.gte.2026-08-10");
    expect(getMarketCalendarDates(calendar, 1)).toMatchObject([
      { dateIso: "2026-08-16", status: "open", relativeLabel: "今週", events: [{ id: "legacy" }] },
    ]);
  });

  it("木曜市の曜日外のイベントを、そのイベントの日付に掲載する", async () => {
    const { client } = fakeClient({ markets: [thursday], market_events: [event("weekday", "thu", "2026-08-12")] });
    const calendar = await fetchMarketCalendar(client, { now });
    expect(getMarketCalendarDates(calendar, 1)).toMatchObject([
      { dateIso: "2026-08-12", status: null, events: [{ id: "weekday" }] },
      { dateIso: "2026-08-13", status: "open", events: [] },
    ]);
  });
});
