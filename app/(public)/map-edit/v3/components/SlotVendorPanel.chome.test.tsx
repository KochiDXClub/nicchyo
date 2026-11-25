import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChomeJudgement } from "@/lib/map/chomeBoundaries";
import SlotVendorPanel from "./SlotVendorPanel";
import type { EditableShop } from "../types";

afterEach(cleanup);

const baseShop: EditableShop = { locationId: "loc-1", id: 1, position: 1, name: "空き", lat: 0, lng: 0, chome: "二丁目" };

const SUNDAY_AREAS = ["一丁目", "二丁目", "三丁目"];

function renderPanel(shop: EditableShop, autoChome: ChomeJudgement | null, onChomeChange = vi.fn(), chomeLabels: string[] = SUNDAY_AREAS) {
  render(
    <SlotVendorPanel
      shop={shop}
      roadName="追手筋"
      vendor={null}
      onChomeChange={onChomeChange}
      chomeLabels={chomeLabels}
      marketName="日曜市"
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

  it("丁目の選択で丁目を選ぶと、その丁目の名前を知らせる", () => {
    const onChomeChange = renderPanel(baseShop, null);
    fireEvent.change(screen.getByLabelText("日曜市の丁目"), { target: { value: "三丁目" } });
    expect(onChomeChange).toHaveBeenCalledWith("三丁目");
  });

  it("選択肢は、その市の丁目の登録をそのまま並べる（木曜市など別の市の丁目も出る）", () => {
    renderPanel(baseShop, null, vi.fn(), ["1丁目", "2丁目"]);
    const options = (screen.getByLabelText("日曜市の丁目") as HTMLSelectElement).options;
    expect(Array.from(options).map((o) => o.value)).toEqual(["auto", "1丁目", "2丁目"]);
  });

  it("手で設定した丁目が市の登録から外れていても、その値を選択肢に残す", () => {
    renderPanel({ ...baseShop, chome: "九丁目", chomeLocked: true }, null, vi.fn(), SUNDAY_AREAS);
    const select = screen.getByLabelText("日曜市の丁目") as HTMLSelectElement;
    expect(select.value).toBe("九丁目");
  });
});
