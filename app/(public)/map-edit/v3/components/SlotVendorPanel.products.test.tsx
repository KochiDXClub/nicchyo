import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SlotVendorPanel from "./SlotVendorPanel";
import type { EditableShop, EditableVendor } from "../types";

afterEach(cleanup);

const shop: EditableShop = { locationId: "loc-1", id: 1, position: 1, name: "朝市の店", lat: 0, lng: 0 };
const manyProducts = Array.from({ length: 12 }, (_, i) => `品${i + 1}`);
const vendor: EditableVendor = { id: "v1", name: "朝市の店", categoryId: null, strength: "", mainProducts: manyProducts };

function renderPanel(onUpdateVendor = vi.fn()) {
  render(
    <SlotVendorPanel
      shop={{ ...shop, vendorId: "v1" }}
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
