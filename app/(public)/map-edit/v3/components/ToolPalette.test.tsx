import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import ToolPalette from "./ToolPalette";

afterEach(cleanup);

describe("ToolPalette", () => {
  it("選んでいる道具を押された状態で示し、押した道具を知らせる", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<ToolPalette tool="select" onChange={onChange} />);
    expect(getByRole("button", { name: /選択/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(getByRole("button", { name: /建物を置く/ }));
    expect(onChange).toHaveBeenCalledWith("placeLandmark");
  });

  it("使えない道具は押せず、理由をツールチップに出す", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<ToolPalette tool="select" onChange={onChange} disabled={{ drawRoad: "準備中です" }} />);
    const button = getByRole("button", { name: /道を描く/ });
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("title")).toBe("準備中です");
    fireEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
  });
});
