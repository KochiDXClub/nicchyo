import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SlotVendorPanel from "./SlotVendorPanel";
import type { EditableShop, EditableVendor } from "../types";
afterEach(cleanup);
const shop: EditableShop = { locationId: "loc-1", id: 1, position: 1, name: "朝市の店", lat: 0, lng: 0, vendorId: "v1" };
const vendor: EditableVendor = { id: "v1", name: "朝市の店", categoryId: null, strength: "", mainProducts: ["野菜"] };
function panel(place?: Partial<EditableShop>, observed = vendor, apply = vi.fn()) {
  render(<SlotVendorPanel shop={{ ...shop, ...place }} roadName={null} vendor={observed} vendors={[observed]} categories={[]} onSelectVendor={vi.fn()} onApplyFieldObservation={apply} onRegisterVendor={vi.fn()} onUpdateVendor={vi.fn()} onClearVendor={vi.fn()} onChomeChange={vi.fn()} autoChome={null} onDelete={vi.fn()} />);
  return apply;
}
describe("SlotVendorPanel の店舗表示", () => {
  it("同じ出店場所に登録された店舗を表示し、店舗情報を編集できない", () => {
    panel({ placeName: "一丁目 南 2", placeVendors: [{ id: "a", name: "店A" }, { id: "b", name: "店B" }] });
    expect(screen.getByRole("link", { name: "店A（詳細を開く）" })).toHaveAttribute("href", "/admin/field/a");
    expect(screen.queryByDisplayValue("朝市の店")).toBeNull();
    expect(screen.getByRole("button", { name: "この区画を削除" })).toBeDisabled();
  });
  it("現場記録の店番違いを警告し、確認した場合だけ編集内容に追加する", () => {
    const observed = { ...vendor, fieldObservation: { lat: 33.56, lng: 133.53, storeNumber: 2, accuracyM: 30, source: "gps", updatedAt: "2026-11-01T00:00:00Z" } };
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const apply = panel(undefined, observed);
    expect(screen.getByText(/記録した店番と、この区画の店番が異なります/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "現場の位置を編集内容に追加" }));
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "現場の位置を編集内容に追加" }));
    expect(apply).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });
});
