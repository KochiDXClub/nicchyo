import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSharedMarketPlaces, loadSharedMarketPlaces, readAllMarketRows } from "./marketPlaces.server";

function db(places: unknown, vendors: unknown, assignments: unknown = { data: [], error: null }) {
  return { from: vi.fn((table: string) => ({ select: () => ({ not: () => ({ order: () => ({ range: async () => table === "market_locations" ? places : table === "vendors" ? vendors : assignments }) }) }) })) } as unknown as SupabaseClient;
}

describe("共通出店場所", () => {
  it("同じ区画に登録された複数店舗をマップ編集へ渡す", async () => {
    const client = db({ data: [{ id: "loc", place_name: "一丁目 南 2", store_number: 1 }], error: null }, { data: [{ id: "a", shop_name: "店A", market_place_id: "loc" }, { id: "b", shop_name: "店B", market_place_id: "loc" }], error: null });
    const result = await attachSharedMarketPlaces(client, [{ locationId: "loc", id: 1, position: 1, name: "店A", lat: 33.56, lng: 133.53 }]);
    expect(result[0]).toMatchObject({ placeName: "一丁目 南 2", placeVendors: [{ id: "a", name: "店A" }, { id: "b", name: "店B" }] });
  });
  it("地図の配置だけがある店舗も、最新の名前付き区画で表示する", async () => {
    const client = db({ data: [{ id: "loc", place_name: "一丁目 南 2", store_number: 1 }], error: null }, { data: [{ id: "a", shop_name: "店A", market_place_id: null }], error: null }, { data: [{ vendor_id: "a", location_id: "loc", market_date: "2026-11-08", created_at: "2026-11-01" }], error: null });
    expect((await loadSharedMarketPlaces(client)).get("loc")?.vendors).toEqual([{ id: "a", name: "店A" }]);
  });
  it("PostgREST のページをまたいで全件取得する", async () => {
    const values = Array.from({ length: 501 }, (_, i) => ({ id: String(i) }));
    const client = { from: () => ({ select: () => ({ not: () => ({ order: () => ({ range: async (from: number, to: number) => ({ data: values.slice(from, to + 1), error: null }) }) }) }) }) } as unknown as SupabaseClient;
    expect((await readAllMarketRows(client, "vendors", "id", "id")).data).toHaveLength(501);
  });
  it("マイグレーション前は空として扱い、それ以外の失敗を隠さない", async () => {
    const missing = { data: null, error: { code: "42703" } };
    expect((await loadSharedMarketPlaces(db(missing, missing))).size).toBe(0);
    await expect(loadSharedMarketPlaces(db(missing, { data: null, error: { code: "500" } }))).rejects.toThrow();
  });
});
