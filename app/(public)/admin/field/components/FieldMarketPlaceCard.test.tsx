import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FieldMarketPlaceCard } from "./FieldMarketPlaceCard";
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("店舗の複数の出店先と期間を表示し、予定管理画面に移動できる", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ places: [
    { id: "p1", official_number: 183, branch_number: 1, store_number: 1, place_name: null },
    { id: "p2", official_number: 183, branch_number: 2, store_number: 2, place_name: null },
  ], memberships: [
    { id: "m1", location_id: "p1", vendor_id: "v1", vendor_number: 1 },
    { id: "m2", location_id: "p2", vendor_id: "v1", vendor_number: 2 },
  ], vendors: [], periods: [{ id: "t1", membership_id: "m1", starts_on: "2026-01-01", ends_on: "2026-06-30" }, { id: "t2", membership_id: "m1", starts_on: "2026-11-01", ends_on: null }] }), { status: 200 })));
  render(<FieldMarketPlaceCard shopId="v1" />);
  expect(await screen.findByText("住所 183-1 ／ 店舗1")).toBeTruthy();
  expect(screen.getByText("住所 183-2 ／ 店舗2")).toBeTruthy();
  expect(screen.getByText("2026-01-01〜2026-06-30")).toBeTruthy();
  expect(screen.getByRole("link", { name: "この店舗の出店予定を管理" })).toHaveAttribute("href", "/admin/market-schedule?vendor=v1");
});
