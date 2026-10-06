import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useLaneKeyboardNavigation } from "./useLaneKeyboardNavigation";
import type { LaneRoadGroup } from "./components/RoadLaneView";
import type { EditableRoad, EditableShop } from "./types";

const shop = (position: number): EditableShop => ({
  locationId: `loc-${position}`,
  id: position,
  position,
  name: `店${position}`,
  lat: 0,
  lng: 0,
});

// 北側 1,3 / 南側 2,4 の2列
const s1 = shop(1);
const s2 = shop(2);
const s3 = shop(3);
const s4 = shop(4);
const road = { id: "r1", name: "通り", kind: "market", widthMeters: 36, points: [] } as EditableRoad;
const groups: LaneRoadGroup[] = [
  {
    road,
    sections: [
      {
        chome: "一丁目",
        north: [s1, s3].map((s, i) => ({ shop: s, side: "north" as const, order: i })),
        south: [s2, s4].map((s, i) => ({ shop: s, side: "south" as const, order: i })),
        columns: 2,
      },
    ],
  },
];

function Harness({ selected, enabled = true, onMove }: { selected: EditableShop | null; enabled?: boolean; onMove: (s: EditableShop) => void }) {
  useLaneKeyboardNavigation({ enabled, selectedShop: selected, shops: [s1, s2, s3, s4], laneGroups: groups, onMove });
  return <input aria-label="検索" />;
}

afterEach(cleanup);

describe("useLaneKeyboardNavigation", () => {
  it("→ / D で同じ側の次、↓ / S で向かい側へ移る", () => {
    const onMove = vi.fn();
    render(<Harness selected={s1} onMove={onMove} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onMove).toHaveBeenLastCalledWith(s3);
    fireEvent.keyDown(window, { key: "s" });
    expect(onMove).toHaveBeenLastCalledWith(s2);
  });

  it("入力欄の中と、Ctrl / Cmd 付きのキーでは移らない", () => {
    const onMove = vi.fn();
    const { getByLabelText } = render(<Harness selected={s1} onMove={onMove} />);
    fireEvent.keyDown(getByLabelText("検索"), { key: "d" });
    fireEvent.keyDown(window, { key: "d", ctrlKey: true });
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("無効のときや区画を選んでいないときは移らない", () => {
    const onMove = vi.fn();
    const { rerender } = render(<Harness selected={s1} enabled={false} onMove={onMove} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    rerender(<Harness selected={null} onMove={onMove} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onMove).not.toHaveBeenCalled();
  });
});
