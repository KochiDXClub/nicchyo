// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCityApi = vi.fn();
const findLatestIntentionSeason = vi.fn();
const responses: unknown[] = [];
const places = [
  { id: "p1", storeNumber: 1, name: null },
  { id: "p2", storeNumber: 2, name: null },
];

vi.mock("@/lib/auth/requireCityApi", () => ({ requireCityApi: () => requireCityApi() }));
vi.mock("@/lib/vendor/intention.server", () => ({
  findLatestIntentionSeason: () => findLatestIntentionSeason(),
  listIntentionPlaces: async () => places,
}));

/** 季節の行と回答の行を返す、最小のクエリの代わり */
function fakeDb() {
  return {
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "maybeSingle", "order", "range"]) q[m] = () => q;
      const result =
        table === "vendor_intention_seasons"
          ? { data: { season_year: 2027, title: "2027年の出店意向", opens_on: "2026-12-01", closes_on: "2027-01-31" }, error: null }
          : { data: responses, error: null };
      q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return q;
    },
  };
}

import { GET } from "./route";

const cityCtx = { user: { id: "c1" }, role: "city_official", adminClient: fakeDb() };
const unauthorized = { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) };

const get = (query = "") => GET(new Request(`http://localhost/api/city/vendor-intention${query}`));

const season = { seasonYear: 2027, title: "t", opensOn: "2026-12-01", closesOn: "2027-01-31" };

beforeEach(() => {
  requireCityApi.mockReset();
  findLatestIntentionSeason.mockReset();
  responses.length = 0;
});

describe("GET /api/city/vendor-intention", () => {
  it("市役所・運営以外は 401", async () => {
    requireCityApi.mockResolvedValue(unauthorized);
    const res = await get();
    expect(res.status).toBe(401);
    expect(findLatestIntentionSeason).not.toHaveBeenCalled();
  });

  it("店舗ごとの回答・店舗 ID・ひとことは返さず、場所ごとの件数だけを返す", async () => {
    requireCityApi.mockResolvedValue(cityCtx);
    findLatestIntentionSeason.mockResolvedValue(season);
    for (let i = 0; i < 3; i += 1) {
      responses.push({ vendor_id: `vendor-${i}`, place_id: "p1", note: "秘密のひとこと" });
    }
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    const json = JSON.stringify(body);
    expect(json).not.toContain("vendor-");
    expect(json).not.toContain("秘密のひとこと");
    expect(body.summary.respondents).toBe(3);
    expect(body.summary.places.find((c: { placeId: string }) => c.placeId === "p1").count).toBe(3);
  });

  it("回答が少ない季節は件数を伏せる", async () => {
    requireCityApi.mockResolvedValue(cityCtx);
    findLatestIntentionSeason.mockResolvedValue(season);
    responses.push({ vendor_id: "v1", place_id: "p2" });
    const body = await (await get()).json();
    expect(body.summary.respondents).toBeNull();
    expect(body.summary.places.every((c: { count: number | null }) => c.count === null)).toBe(true);
  });

  it("季節の指定が数字でなければ 400", async () => {
    requireCityApi.mockResolvedValue(cityCtx);
    const res = await get("?season=abc");
    expect(res.status).toBe(400);
  });

  it("季節が1つもなければ summary は null", async () => {
    requireCityApi.mockResolvedValue(cityCtx);
    findLatestIntentionSeason.mockResolvedValue(null);
    const body = await (await get()).json();
    expect(body).toEqual({ season: null, summary: null });
  });
});
