import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import IntentionPointMap, { type IntentionMapPoint } from "./IntentionPointMap";

const points: IntentionMapPoint[] = [
  { id: "a", label: "1番", chome: 1, lat: 33.56, lng: 133.53 },
  { id: "b", label: "2番", chome: 2, lat: 33.561, lng: 133.54 },
  { id: "c", label: "場所なし", chome: null, lat: null, lng: null },
];

describe("IntentionPointMap", () => {
  it("選べる丁目の点だけを押せる（ほかの丁目は押せない）", () => {
    const onSelect = vi.fn();
    render(<IntentionPointMap points={points} selectedId={null} activeChome={1} onSelect={onSelect} label="地図" />);
    const first = screen.getByRole("button", { name: "1番" });
    fireEvent.click(first);
    expect(onSelect).toHaveBeenCalledWith(points[0]);
    expect(screen.queryByRole("button", { name: "2番" })).toBeNull();
  });

  it("キーボードでも Enter で選べる", () => {
    const onSelect = vi.fn();
    render(<IntentionPointMap points={points} selectedId={null} activeChome={null} onSelect={onSelect} label="地図" />);
    fireEvent.keyDown(screen.getByRole("button", { name: "2番" }), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(points[1]);
  });

  it("位置の無い場所は点にせず、選ぶ対象にもしない", () => {
    render(<IntentionPointMap points={points} selectedId={null} activeChome={null} onSelect={() => {}} label="地図" />);
    expect(screen.queryByRole("button", { name: "場所なし" })).toBeNull();
  });

  it("位置が1つも無いときは、地図の代わりに説明を出す", () => {
    render(<IntentionPointMap points={[points[2]]} selectedId={null} activeChome={null} label="地図" />);
    expect(screen.getByText("地図に出せる場所がまだありません。")).toBeTruthy();
  });
});
