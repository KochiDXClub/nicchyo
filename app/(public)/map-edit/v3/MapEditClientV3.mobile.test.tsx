import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MapEditClientV3 from "./MapEditClientV3";
import type { CanvasHandlers } from "./types";

vi.mock("./components/MapEditCanvasMapLibre", () => ({
  default: ({ handlers }: { handlers: CanvasHandlers }) => <div><button type="button" onClick={() => handlers.onSelectShop("a")}>区画Aを選択</button><button type="button" onClick={() => handlers.onSelectShop("b")}>区画Bを選択</button></div>,
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("マップ編集のタップ操作", () => {
  it("店舗を選んで移動先を指定し、確認してから未保存の編集に追加できる", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ shops: [
      { locationId: "a", id: 1, position: 1, name: "山の店", vendorId: "v1", lat: 33.56, lng: 133.53 },
      { locationId: "b", id: 2, position: 2, name: "空き区画", lat: 33.56, lng: 133.531 },
    ], vendors: [{ id: "v1", name: "山の店", categoryId: null, strength: "", mainProducts: [] }], roads: [], landmarks: [], categories: [], schemaReady: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<MapEditClientV3 />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText("地図の登録状況").textContent).toContain("1"));
    fireEvent.click(screen.getByRole("button", { name: "区画Aを選択" }));
    fireEvent.click(await screen.findByRole("button", { name: "移動先の区画を選ぶ" }));
    expect(screen.getByText(/移動先の区画をタップ/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "区画Bを選択" }));
    expect(screen.getByText(/移動先の区画をタップ/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "区画Bを選択" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("登録済みの出店者から選ぶ")).toHaveValue("v1");
    expect(screen.getByRole("button", { name: /変更を保存/ })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
