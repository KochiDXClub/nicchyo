import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SlotVendorPanel from "./SlotVendorPanel";
import type { EditableShop, EditableVendor } from "../types";

afterEach(cleanup);

const shop: EditableShop = { locationId: "loc-1", id: 1, position: 1, name: "朝市の店", lat: 0, lng: 0 };
const manyProducts = Array.from({ length: 12 }, (_, i) => `品${i + 1}`);
const vendor: EditableVendor = { id: "v1", name: "朝市の店", categoryId: null, strength: "", mainProducts: manyProducts };

function renderPanel(onUpdateVendor = vi.fn(), shared?: Pick<EditableShop, "placeName" | "placeVendors">) {
  render(
    <SlotVendorPanel
      shop={{ ...shop, ...shared, vendorId: "v1" }}
      roadName={null}
      vendor={vendor}
      vendors={[vendor]}
      categories={[]}
      onSelectVendor={vi.fn()}
      onRegisterVendor={vi.fn()}
      onUpdateVendor={onUpdateVendor}
      onClearVendor={vi.fn()}
      onChomeChange={vi.fn()}
      autoChome={null}
      onDelete={vi.fn()}
    />
  );
  return { onUpdateVendor, input: screen.getByDisplayValue(manyProducts.join("、")) };
}

describe("SlotVendorPanel の主な商品", () => {
  it("現場記録の店番違いを警告し、確認した場合だけ編集内容に追加する", () => {
    const observed = { ...vendor, fieldObservation: { lat: 33.56, lng: 133.53, storeNumber: 2, accuracyM: 30, source: "gps", updatedAt: "2026-11-01T00:00:00Z" } };
    const apply = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<SlotVendorPanel shop={{ ...shop, vendorId: "v1" }} roadName={null} vendor={observed} vendors={[observed]} categories={[]} onSelectVendor={vi.fn()} onApplyFieldObservation={apply} onRegisterVendor={vi.fn()} onUpdateVendor={vi.fn()} onClearVendor={vi.fn()} onChomeChange={vi.fn()} autoChome={null} onDelete={vi.fn()} />);
    expect(screen.getByText(/記録した店番と、この区画の店番が異なります/)).toBeTruthy();
    const button = screen.getByRole("button", { name: "現場の位置を編集内容に追加" });
    fireEvent.click(button);
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(apply).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });
  it("同じ出店場所に登録された複数店舗を表示する", () => {
    renderPanel(vi.fn(), { placeName: "一丁目 南 2", placeVendors: [{ id: "a", name: "店A" }, { id: "b", name: "店B" }] });
    expect(screen.getByText("出店場所: 一丁目 南 2")).toBeTruthy();
    expect(screen.getByRole("link", { name: "店A（詳細を開く）" })).toHaveAttribute("href", "/admin/field/a");
    expect(screen.getByRole("link", { name: "店B（詳細を開く）" })).toHaveAttribute("href", "/admin/field/b");
    expect(screen.getByRole("button", { name: "この区画を削除" })).toBeDisabled();
  });

  it("既に別の店舗が場所に登録されていれば配置前に確認する", () => {
    const onSelectVendor = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const second = { ...vendor, id: "v2", name: "別の店" };
    render(<SlotVendorPanel shop={{ ...shop, placeName: "一丁目 南 2", placeVendors: [{ id: "v1", name: "朝市の店" }, { id: "v2", name: "別の店" }] }} roadName={null} vendor={null} vendors={[vendor, second]} categories={[]} onSelectVendor={onSelectVendor} onRegisterVendor={vi.fn()} onUpdateVendor={vi.fn()} onClearVendor={vi.fn()} onChomeChange={vi.fn()} autoChome={null} onDelete={vi.fn()} />);
    const select = screen.getByLabelText("登録済みの出店者から選ぶ");
    fireEvent.change(select, { target: { value: "v2" } });
    expect(onSelectVendor).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: "v2" } });
    expect(onSelectVendor).toHaveBeenCalledWith("v2");
    expect(confirm).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });

  it("上限を超えた既存の品目は、欄にフォーカスして離れただけでは切り捨てない", () => {
    const { onUpdateVendor, input } = renderPanel();
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onUpdateVendor).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe(manyProducts.join("、"));
  });

  it("欄を書き換えて上限を超えたときは、上限までにして知らせる", () => {
    const { onUpdateVendor, input } = renderPanel();
    fireEvent.change(input, { target: { value: `${manyProducts.join("、")}、品13` } });
    fireEvent.blur(input);
    expect(onUpdateVendor).toHaveBeenCalledTimes(1);
    expect(onUpdateVendor.mock.calls[0][0].mainProducts).toHaveLength(10);
    expect(screen.getByText(/11 件目以降は入れていません/)).toBeTruthy();
  });
});
