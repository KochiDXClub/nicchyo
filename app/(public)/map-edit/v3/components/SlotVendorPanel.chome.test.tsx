import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SlotVendorPanel from "./SlotVendorPanel";
import type { EditableShop } from "../types";

afterEach(cleanup);

const baseShop: EditableShop = { locationId: "loc-1", id: 1, position: 1, name: "空き", lat: 0, lng: 0, chome: "二丁目" };

const SUNDAY_AREAS = ["一丁目", "二丁目", "三丁目"];

function renderPanel(shop: EditableShop, onChomeChange = vi.fn(), chomeLabels: string[] = SUNDAY_AREAS) {
  render(
    <SlotVendorPanel
      shop={shop}
      roadName="追手筋"
      vendor={null}
      onChomeChange={onChomeChange}
      chomeLabels={chomeLabels}
      marketName="日曜市"
      onDelete={vi.fn()}
    />
  );
  return onChomeChange;
}

describe("SlotVendorPanel の丁目", () => {
  it("丁目を選ぶと、その丁目の名前で知らせる", () => {
    const onChomeChange = renderPanel(baseShop);
    fireEvent.change(screen.getByLabelText("日曜市の丁目"), { target: { value: "三丁目" } });
    expect(onChomeChange).toHaveBeenCalledWith("三丁目");
  });

  it("選択肢は未設定と、その市の丁目の登録をそのまま並べる（自動はない）", () => {
    renderPanel({ ...baseShop, chome: undefined }, vi.fn(), ["1丁目", "2丁目"]);
    const options = (screen.getByLabelText("日曜市の丁目") as HTMLSelectElement).options;
    expect(Array.from(options).map((o) => o.value)).toEqual(["", "1丁目", "2丁目"]);
  });

  it("今の丁目が市の登録から外れていても、その値を選択肢に残す", () => {
    renderPanel({ ...baseShop, chome: "九丁目" }, vi.fn(), SUNDAY_AREAS);
    const select = screen.getByLabelText("日曜市の丁目") as HTMLSelectElement;
    expect(select.value).toBe("九丁目");
  });
});
