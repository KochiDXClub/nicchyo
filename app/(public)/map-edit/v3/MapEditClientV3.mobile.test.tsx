import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MapEditClientV3 from "./MapEditClientV3";
import type { CanvasHandlers } from "./types";
vi.mock("./components/MapEditCanvasMapLibre", () => ({ default: ({ handlers }: { handlers: CanvasHandlers }) => <button type="button" onClick={() => handlers.onSelectShop("a")}>区画Aを選択</button> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("マップ編集のタップ操作", () => {
  it("区画を選んで店舗の情報を参照し、マップ上では店舗情報を編集しない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ shops: [{ locationId: "a", id: 1, position: 1, name: "山の店", vendorId: "v1", lat: 33.56, lng: 133.53 }], vendors: [{ id: "v1", name: "山の店", categoryId: null, strength: "", mainProducts: [] }], roads: [], landmarks: [], categories: [], schemaReady: true }) }));
    render(<MapEditClientV3 />);
    await waitFor(() => expect(screen.getByLabelText("地図の登録状況").textContent).toContain("1"));
    fireEvent.click(screen.getByRole("button", { name: "区画Aを選択" }));
    expect(await screen.findByRole("link", { name: "現場登録で店舗情報を確認" })).toHaveAttribute("href", "/admin/field/v1");
    expect(screen.queryByLabelText("店名（必須）")).toBeNull();
    expect(screen.queryByRole("button", { name: "移動先の区画を選ぶ" })).toBeNull();
  });
});
