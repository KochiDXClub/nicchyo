// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireVendorContext = vi.fn();
const findOpenIntentionSeason = vi.fn();
const readOwnIntentionResponse = vi.fn();
const listIntentionPlaces = vi.fn();
const readVendorCurrentPlaceId = vi.fn();
const findIntentionPlace = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/vendor/shopContext.server", () => ({
  requireVendorContext: (...args: unknown[]) => requireVendorContext(...args),
}));
vi.mock("@/lib/vendor/intention.server", () => ({
  intentionDb: () => ({
    from: () => ({
      upsert: (...args: unknown[]) => {
        upsert(...args);
        return chain({ data: { season_year: 2027, chome: 3, place_id: null, updated_at: "now" }, error: null });
      },
    }),
  }),
  findOpenIntentionSeason: (...args: unknown[]) => findOpenIntentionSeason(...args),
  readOwnIntentionResponse: (...args: unknown[]) => readOwnIntentionResponse(...args),
  listIntentionPlaces: (...args: unknown[]) => listIntentionPlaces(...args),
  readVendorCurrentPlaceId: (...args: unknown[]) => readVendorCurrentPlaceId(...args),
  findIntentionPlace: (...args: unknown[]) => findIntentionPlace(...args),
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
const OTHER_CHOME_PLACE = "44444444-4444-4444-8444-444444444444";
const openSeason = { seasonYear: 2027, title: "2027年の出店意向", opensOn: "2026-12-01", closesOn: "2027-01-31" };
const allowed = { ok: true, user: { id: "u1" }, vendorId: OWN_VENDOR, membership: {}, supabase: {} };
const forbidden = { ok: false, response: new Response(JSON.stringify({ error: "この操作をする権限がありません" }), { status: 403 }) };

const put = (body: unknown) =>
  PUT(new Request("http://localhost/api/vendor/intention", { method: "PUT", body: JSON.stringify(body) }));

/** 丁目だけ（場所なし） */
const chomeOnly = { chome: 3 };
/** 丁目と、その丁目の場所 */
const withPlace = { chome: 3, placeId: PLACE };

beforeEach(() => {
  requireVendorContext.mockReset();
  findOpenIntentionSeason.mockReset();
  readOwnIntentionResponse.mockReset();
  listIntentionPlaces.mockReset();
  readVendorCurrentPlaceId.mockReset();
  findIntentionPlace.mockReset();
  upsert.mockReset();
  findOpenIntentionSeason.mockResolvedValue(openSeason);
  readOwnIntentionResponse.mockResolvedValue(null);
  listIntentionPlaces.mockResolvedValue([{ id: PLACE, storeNumber: 12, name: null, chome: 3, lat: 33.5, lng: 133.5 }]);
  readVendorCurrentPlaceId.mockResolvedValue(PLACE);
  findIntentionPlace.mockResolvedValue({ id: PLACE, storeNumber: 12, name: null, chome: 3, lat: 33.5, lng: 133.5 });
});

describe("出店意向の権限と保存（丁目 → 場所）", () => {
  it("読み書きとも store_edit の権限を確かめる", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    await GET();
    await put(chomeOnly);
    expect(requireVendorContext).toHaveBeenNthCalledWith(1, { permission: "store_edit" });
    expect(requireVendorContext).toHaveBeenNthCalledWith(2, { permission: "store_edit" });
  });

  it("権限がなければ 403 で、何も保存しない", async () => {
    requireVendorContext.mockResolvedValue(forbidden);
    const res = await put(chomeOnly);
    expect(res.status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("店舗は本文ではなく所属（認証の結果）で決める。本文の vendor_id は無視する", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    const res = await put({ ...withPlace, vendor_id: OTHER_VENDOR, vendorId: OTHER_VENDOR });
    expect(res.status).toBe(200);
    const [row, options] = upsert.mock.calls[0];
    expect(row.vendor_id).toBe(OWN_VENDOR);
    expect(row.season_year).toBe(2027);
    expect(options).toEqual({ onConflict: "season_year,vendor_id" });
  });

  it("丁目だけでも保存できる（場所は null）", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    const res = await put(chomeOnly);
    expect(res.status).toBe(200);
    const [row] = upsert.mock.calls[0];
    expect(row.chome).toBe(3);
    expect(row.place_id).toBeNull();
    expect(findIntentionPlace).not.toHaveBeenCalled();
  });

  it("丁目と場所を保存するとき、場所はその丁目の場所である必要がある", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    const res = await put(withPlace);
    expect(res.status).toBe(200);
    const [row] = upsert.mock.calls[0];
    expect(row.chome).toBe(3);
    expect(row.place_id).toBe(PLACE);
  });

  it("場所が選んだ丁目と違うときは 400 で、何も保存しない", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    findIntentionPlace.mockResolvedValue({ id: OTHER_CHOME_PLACE, storeNumber: 99, name: null, chome: 5, lat: 33.5, lng: 133.5 });
    const res = await put({ chome: 3, placeId: OTHER_CHOME_PLACE });
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("丁目がない・範囲外・場所の形がおかしいときは 400 で、何も保存しない", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    expect((await put({})).status).toBe(400);
    expect((await put({ chome: 8 })).status).toBe(400);
    expect((await put({ chome: 3, placeId: "12" })).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("受付期間外は 409 で、何も保存しない", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    findOpenIntentionSeason.mockResolvedValue(null);
    const res = await put(chomeOnly);
    expect(res.status).toBe(409);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("存在しない場所は 400 で、何も保存しない", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    findIntentionPlace.mockResolvedValue(null);
    const res = await put(withPlace);
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("区画数や頻度など、丁目と場所以外の項目は保存しない", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    await put({ ...chomeOnly, boothCount: 3, frequency: "weekly", note: "x" });
    const [row] = upsert.mock.calls[0];
    expect(Object.keys(row).sort()).toEqual(["chome", "place_id", "season_year", "updated_at", "vendor_id"]);
  });

  it("GET は受付中の季節・自分の回答・選べる場所・今の場所だけを返す（受付外なら editable は false）", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    findOpenIntentionSeason.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual({ season: null, response: null, places: [], currentPlaceId: null, editable: false });
    expect(readOwnIntentionResponse).not.toHaveBeenCalled();
    expect(readVendorCurrentPlaceId).not.toHaveBeenCalled();
  });

  it("GET は今出店している場所を currentPlaceId で返す（初期選択用）", async () => {
    requireVendorContext.mockResolvedValue(allowed);
    const res = await GET();
    expect((await res.json()).currentPlaceId).toBe(PLACE);
    expect(readVendorCurrentPlaceId).toHaveBeenCalledWith(expect.anything(), OWN_VENDOR);
  });
});
