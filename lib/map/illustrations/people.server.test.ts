import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/requireAdminApi", () => ({ createAdminServiceClientOrNull: createClient }));

import { fetchMarketPeople } from "./people.server";

const sunday = { id: "sun", name: "日曜市", slug: "nichiyo", weekday: 0 };
const thursday = { id: "thu", name: "木曜市", slug: "mokuyo", weekday: 4 };
const sundayMidnight = new Date("2026-11-21T15:00:00Z");
const thursdayMidnight = new Date("2026-11-18T15:00:00Z");

function setup(statuses: { market_id: string; status: string }[] = [], unavailable = false) {
  const eq = vi.fn();
  const inFilter = vi.fn();
  const contains = vi.fn();
  createClient.mockReturnValue({ from: (table: string) => {
    const placements = [
      { id: "sun", market_id: "sun", latitude: 33.56, weekdays: [0] },
      { id: "sun-other", market_id: "sun", latitude: 33.562, weekdays: [4, 6] },
      { id: "thu", market_id: "thu", latitude: 33.558, weekdays: [0, 4] },
    ].map((row) => ({ ...row, image_url: "/people.webp", longitude: 133.54, width_px: 90 }));
    let data = table === "market_days" ? statuses : placements;
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => { eq(table, ...args); return query; },
      in: (...args: unknown[]) => { inFilter(table, ...args); return query; },
      contains: (column: string, [day]: number[]) => {
        contains(table, column, [day]);
        data = placements.filter(({ weekdays }) => weekdays.includes(day));
        return query;
      },
      order: () => query,
      then: (resolve: (value: unknown) => unknown) => resolve({ data, error: table === "market_days" && unavailable }),
    };
    return query;
  }});
  return { eq, inFilter, contains };
}

describe("市ごとの来訪者イラスト", () => {
  beforeEach(() => createClient.mockReset());

  it("同じ画像でも場所ごとの曜日で切り替え、地図装飾だけを返す", async () => {
    const { eq, inFilter, contains } = setup();
    expect(await fetchMarketPeople([sunday, thursday], sundayMidnight)).toMatchObject([
      { key: "people:sun", lat: 33.56, name: "", decorative: true },
      { key: "people:thu" },
    ]);
    expect(await fetchMarketPeople([sunday, thursday], thursdayMidnight)).toMatchObject([
      { key: "people:sun-other", lat: 33.562 },
      { key: "people:thu" },
    ]);
    expect(contains).toHaveBeenCalledWith("map_people_illustrations", "weekdays", [4]);
    expect(eq).toHaveBeenCalledWith("market_days", "market_date", "2026-11-19");
    expect(eq).toHaveBeenCalledWith("map_people_illustrations", "enabled", true);
    expect(eq).toHaveBeenCalledWith("map_people_illustrations", "markets.is_public", true);
    expect(inFilter).toHaveBeenCalledWith("map_people_illustrations", "market_id", ["sun", "thu"]);
  });

  it.each(["closed", "cancelled"])("休市・中止（%s）は隠し、選択した曜日の特別開催は表示する", async (status) => {
    setup([{ market_id: "sun", status }, { market_id: "thu", status: "special" }]);
    expect(await fetchMarketPeople([sunday, thursday], sundayMidnight)).toMatchObject([{ key: "people:thu" }]);
  });

  it("特別開催でも配置の曜日を上書きしない", async () => {
    setup([{ market_id: "thu", status: "special" }]);
    expect(await fetchMarketPeople([sunday, thursday], new Date("2026-11-17T03:00:00Z"))).toEqual([]);
  });

  it("開催状況を取得できない日は表示しない", async () => {
    setup([], true);
    expect(await fetchMarketPeople([sunday, thursday], sundayMidnight)).toEqual([]);
  });
});
