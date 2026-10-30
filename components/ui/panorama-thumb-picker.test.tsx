import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PanoramaThumbPicker } from "./panorama-thumb-picker";

describe("PanoramaThumbPicker", () => {
  it("矢印キーで、切り出しの位置を左右に動かせる", () => {
    const onChange = vi.fn();
    render(<PanoramaThumbPicker src="blob:x" value={0.5} onChange={onChange} />);
    const slider = screen.getByRole("slider", { name: "サムネイルにする部分" });

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowLeft" });

    expect(onChange).toHaveBeenNthCalledWith(1, 0.52);
    expect(onChange).toHaveBeenNthCalledWith(2, 0.48);
  });

  it("写真の上を押すと、その位置が中心になる", () => {
    const onChange = vi.fn();
    render(<PanoramaThumbPicker src="blob:x" value={0.5} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    slider.getBoundingClientRect = () => ({ left: 100, width: 400, top: 0, right: 500, bottom: 200, height: 200, x: 100, y: 0, toJSON: () => ({}) });

    fireEvent.pointerDown(slider, { clientX: 200, pointerId: 1 });

    expect(onChange).toHaveBeenCalledWith(0.25);
  });

  it("押したまま動かすと位置が追いかけ、離したあとは動かない", () => {
    const onChange = vi.fn();
    render(<PanoramaThumbPicker src="blob:x" value={0.5} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    slider.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, right: 400, bottom: 200, height: 200, x: 0, y: 0, toJSON: () => ({}) });

    fireEvent.pointerMove(slider, { clientX: 100, buttons: 1 });
    expect(onChange).toHaveBeenLastCalledWith(0.25);

    onChange.mockClear();
    fireEvent.pointerMove(slider, { clientX: 300, buttons: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("使えないときは、動かしても何も起きない", () => {
    const onChange = vi.fn();
    render(<PanoramaThumbPicker src="blob:x" value={0.5} onChange={onChange} disabled />);

    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });

    expect(onChange).not.toHaveBeenCalled();
  });
});
