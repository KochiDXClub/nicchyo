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
  createClient.mockReturnValue({ from: (table: string) => {
    const data = table === "market_days" ? statuses : ["sun", "thu"].map((id) => ({
      id, market_id: id, image_url: "/people.webp", latitude: 33.56, longitude: 133.54, width_px: 90,
    }));
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => { eq(table, ...args); return query; },
      in: (...args: unknown[]) => { inFilter(table, ...args); return query; },
      order: () => query,
      then: (resolve: (value: unknown) => unknown) => resolve({ data, error: table === "market_days" && unavailable }),
    };
    return query;
  }});
  return { eq, inFilter };
}

describe("市ごとの来訪者イラスト", () => {
  beforeEach(() => createClient.mockReset());

  it("JSTの日付と市の開催曜日に合わせて、地図装飾だけを返す", async () => {
    const { eq, inFilter } = setup();
    expect(await fetchMarketPeople([sunday, thursday], sundayMidnight)).toMatchObject([{ key: "people:sun", name: "", decorative: true }]);
    expect(await fetchMarketPeople([sunday, thursday], thursdayMidnight)).toMatchObject([{ key: "people:thu" }]);
    expect(eq).toHaveBeenCalledWith("market_days", "market_date", "2026-11-19");
    expect(eq).toHaveBeenCalledWith("map_people_illustrations", "enabled", true);
    expect(eq).toHaveBeenCalledWith("map_people_illustrations", "markets.is_public", true);
    expect(inFilter).toHaveBeenCalledWith("map_people_illustrations", "market_id", ["sun", "thu"]);
  });

  it.each(["closed", "cancelled"])("休市・中止（%s）は隠し、通常曜日外の特別開催は表示する", async (status) => {
    setup([{ market_id: "sun", status }, { market_id: "thu", status: "special" }]);
    expect(await fetchMarketPeople([sunday, thursday], sundayMidnight)).toMatchObject([{ key: "people:thu" }]);
  });

  it("開催状況を取得できない日は表示しない", async () => {
    setup([], true);
    expect(await fetchMarketPeople([sunday, thursday], sundayMidnight)).toEqual([]);
  });
});
