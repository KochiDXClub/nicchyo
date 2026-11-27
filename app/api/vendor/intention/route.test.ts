// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireVendorContext = vi.fn();
const findOpenIntentionSeason = vi.fn();
const readOwnIntentionResponse = vi.fn();
const listIntentionPlaces = vi.fn();
const readVendorCurrentPlaceId = vi.fn();
const intentionPlaceExists = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/vendor/shopContext.server", () => ({
  requireVendorContext: (...args: unknown[]) => requireVendorContext(...args),
}));
vi.mock("@/lib/vendor/intention.server", () => ({
  intentionDb: () => ({
    from: () => ({
      upsert: (...args: unknown[]) => {
        upsert(...args);
        return chain({ data: { season_year: 2027, place_id: PLACE, updated_at: "now" }, error: null });
      },
    }),
  }),
  findOpenIntentionSeason: (...args: unknown[]) => findOpenIntentionSeason(...args),
  readOwnIntentionResponse: (...args: unknown[]) => readOwnIntentionResponse(...args),
  listIntentionPlaces: (...args: unknown[]) => listIntentionPlaces(...args),
  readVendorCurrentPlaceId: (...args: unknown[]) => readVendorCurrentPlaceId(...args),
  intentionPlaceExists: (...args: unknown[]) => intentionPlaceExists(...args),
}));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));

/** await できて、どのメソッドをつないでも同じ結果を返すクエリの代わり */
function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "single", "maybeSingle"]) q[m] = () => q;
  q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return q;
}

import { GET, PUT } from "./route";

const OWN_VENDOR = "11111111-1111-4111-8111-111111111111";
const OTHER_VENDOR = "22222222-2222-4222-8222-222222222222";
const PLACE = "33333333-3333-4333-8333-333333333333";
const openSeason = { seasonYear: 2027, title: "2027年の出店意向", opensOn: "2026-12-01", closesOn: "2027-01-31" };
const allowed = { ok: true, user: { id: "u1" }, vendorId: OWN_VENDOR, membership: {}, supabase: {} };
const forbidden = { ok: false, response: new Response(JSON.stringify({ error: "この操作をする権限がありません" }), { status: 403 }) };

const put = (body: unknown) =>
  PUT(new Request("http://localhost/api/vendor/intention", { method: "PUT", body: JSON.stringify(body) }));

const validBody = { placeId: PLACE };

beforeEach(() => {
  requireVendorContext.mockReset();
  findOpenIntentionSeason.mockReset();
  readOwnIntentionResponse.mockReset();
  listIntentionPlaces.mockReset();
  readVendorCurrentPlaceId.mockReset();
  intentionPlaceExists.mockReset();
  upsert.mockReset();
  findOpenIntentionSeason.mockResolvedValue(openSeason);
  readOwnIntentionResponse.mockResolvedValue(null);
  listIntentionPlaces.mockResolvedValue([{ id: PLACE, storeNumber: 12, name: null }]);
  readVendorCurrentPlaceId.mockResolvedValue(PLACE);
  intentionPlaceExists.mockResolvedValue(true);
});

describe("出店意向の権限と保存", () => {
  it("読み書きとも store_edit の権限を確かめる", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    await GET();
    await put(validBody);
    expect(requireVendorContext).toHaveBeenNthCalledWith(1, { permission: "store_edit" });
    expect(requireVendorContext).toHaveBeenNthCalledWith(2, { permission: "store_edit" });
  });

  it("権限がなければ 403 で、何も保存しない", async () => {
    requireVendorContext.mockResolvedValue(forbidden);
    const res = await put(validBody);
    expect(res.status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("店舗は本文ではなく所属（認証の結果）で決める。本文の vendor_id は無視する", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    const res = await put({ ...validBody, vendor_id: OTHER_VENDOR, vendorId: OTHER_VENDOR });
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledTimes(1);
    const [row, options] = upsert.mock.calls[0];
    expect(row.vendor_id).toBe(OWN_VENDOR);
    expect(row.place_id).toBe(PLACE);
    expect(row.season_year).toBe(2027);
    expect(options).toEqual({ onConflict: "season_year,vendor_id" });
  });

  it("区画数や頻度など、場所以外の項目は保存しない", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    await put({ ...validBody, boothCount: 3, frequency: "weekly", note: "x" });
    const [row] = upsert.mock.calls[0];
    expect(Object.keys(row).sort()).toEqual(["place_id", "season_year", "updated_at", "vendor_id"]);
  });

  it("受付期間外は 409 で、何も保存しない", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    findOpenIntentionSeason.mockResolvedValue(null);
    const res = await put(validBody);
    expect(res.status).toBe(409);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("場所が選ばれていない・UUID でないときは 400 で、何も保存しない", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    expect((await put({})).status).toBe(400);
    expect((await put({ placeId: "12" })).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("存在しない場所は 400 で、何も保存しない", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    intentionPlaceExists.mockResolvedValue(false);
    const res = await put(validBody);
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("GET は受付中の季節・自分の回答・選べる場所だけを返す（受付外なら editable は false）", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    findOpenIntentionSeason.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ season: null, response: null, places: [], currentPlaceId: null, editable: false });
    expect(readOwnIntentionResponse).not.toHaveBeenCalled();
    expect(readVendorCurrentPlaceId).not.toHaveBeenCalled();
  });

  it("GET は今出店している場所を currentPlaceId で返す（初期選択用）", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    findOpenIntentionSeason.mockResolvedValue({ seasonYear: 2027, title: "2027年", opensOn: "2026-12-01", closesOn: "2026-12-31" });
    const res = await GET();
    expect((await res.json()).currentPlaceId).toBe(PLACE);
    expect(readVendorCurrentPlaceId).toHaveBeenCalledWith(expect.anything(), OWN_VENDOR);
  });

  it("GET は自分の店舗の所属で回答を探す", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    await GET();
    expect(readOwnIntentionResponse).toHaveBeenCalledWith(expect.anything(), 2027, OWN_VENDOR);
  });
});
