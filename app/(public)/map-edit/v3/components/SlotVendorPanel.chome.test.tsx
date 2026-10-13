import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChomeJudgement } from "@/lib/map/chomeBoundaries";
import SlotVendorPanel from "./SlotVendorPanel";
import type { EditableShop } from "../types";

afterEach(cleanup);

const baseShop: EditableShop = { locationId: "loc-1", id: 1, position: 1, name: "空き", lat: 0, lng: 0, chome: "二丁目" };

function renderPanel(shop: EditableShop, autoChome: ChomeJudgement | null, onChomeChange = vi.fn()) {
  render(
    <SlotVendorPanel
      shop={shop}
      roadName="追手筋"
      vendor={null}
      vendors={[]}
      categories={[]}
      onSelectVendor={vi.fn()}
      onRegisterVendor={vi.fn()}
      onUpdateVendor={vi.fn()}
      onClearVendor={vi.fn()}
      onChomeChange={onChomeChange}
      autoChome={autoChome}
      onDelete={vi.fn()}
    />
  );
  return onChomeChange;
}

describe("SlotVendorPanel の丁目", () => {
  it("手で設定していない区画で、今の丁目と自動判定が違うときは、ボタンで自動判定の値にできる", () => {
    const onChomeChange = renderPanel(baseShop, { status: "ok", chomeId: 3 });
    expect(screen.getByText(/今の丁目と自動判定が違います/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /自動判定の値（3丁目）にする/ }));
    expect(onChomeChange).toHaveBeenCalledWith("auto");
  });

  it("丁目が自動判定と同じなら、ボタンは出さない", () => {
    renderPanel(baseShop, { status: "ok", chomeId: 2 });
    expect(screen.queryByRole("button", { name: /自動判定の値/ })).toBeNull();
  });

  it("手で設定した区画や、判定できない区画には、ボタンを出さない", () => {
    renderPanel({ ...baseShop, chomeLocked: true }, { status: "ok", chomeId: 3 });
    expect(screen.queryByRole("button", { name: /自動判定の値/ })).toBeNull();
    cleanup();
    renderPanel(baseShop, { status: "near_boundary", chomeId: null, candidates: [2, 3] });
    expect(screen.queryByRole("button", { name: /自動判定の値/ })).toBeNull();
  });

  it("丁目の選択で丁目を選ぶと、その丁目を知らせる", () => {
    const onChomeChange = renderPanel(baseShop, null);
    fireEvent.change(screen.getByLabelText("日曜市の丁目"), { target: { value: "5" } });
    expect(onChomeChange).toHaveBeenCalledWith(5);
  });
});
