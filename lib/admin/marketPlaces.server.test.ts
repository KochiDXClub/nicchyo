import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attachFieldObservations, attachSharedMarketPlaces, loadSharedMarketPlaces, readAllMarketRows } from "./marketPlaces.server";

function db(places: unknown, vendors: unknown, assignments: unknown = { data: [], error: null }, memberships: unknown = { data: [], error: null }) {
  return { from: vi.fn((table: string) => ({ select: () => ({ not: () => ({ order: () => ({ range: async () => table === "market_locations" ? places : table === "vendors" ? vendors : table === "market_place_memberships" ? memberships : assignments }) }) }) })) } as unknown as SupabaseClient;
}

describe("共通出店場所", () => {
  it("同じ店舗が複数の場所に登録されていれば、各場所に表示する", async () => {
    const client = db({ data: [{ id: "x", place_name: "183-1", store_number: 1 }, { id: "y", place_name: "183-2", store_number: 2 }], error: null }, { data: [{ id: "a", shop_name: "店A", market_place_id: null }], error: null }, { data: [], error: null }, { data: [{ id: "m1", location_id: "x", vendor_id: "a" }, { id: "m2", location_id: "y", vendor_id: "a" }], error: null });
    const result = await loadSharedMarketPlaces(client);
    expect(result.get("x")?.vendors).toEqual([{ id: "a", name: "店A" }]);
    expect(result.get("y")?.vendors).toEqual([{ id: "a", name: "店A" }]);
  });
  it("範囲内の現場記録を確認用に添え、範囲外の記録は渡さない", async () => {
    const vendors = [{ id: "a", name: "店A", categoryId: null, strength: "", mainProducts: [] }, { id: "b", name: "店B", categoryId: null, strength: "", mainProducts: [] }];
    const client = db(null, null, { data: [{ vendor_id: "a", latitude: 33.56, longitude: 133.53, store_number: 1, accuracy_m: 10, source: "gps", updated_at: "2026-11-01T00:00:00Z" }, { vendor_id: "b", latitude: 0, longitude: 0, updated_at: "2026-11-01T00:00:00Z" }], error: null });
    const result = await attachFieldObservations(client, vendors);
    expect(result[0].fieldObservation).toMatchObject({ lat: 33.56, lng: 133.53, accuracyM: 10 });
    expect(result[1].fieldObservation).toBeUndefined();
  });
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
