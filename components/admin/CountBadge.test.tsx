import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountBadge } from "./CountBadge";

describe("CountBadge", () => {
  it("0 件のときは何も出さない", () => {
    const { container } = render(<CountBadge count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("件数を赤い丸で出す。99 を超えたら 99+", () => {
    const { rerender } = render(<CountBadge count={3} label="受信トレイ" />);
    expect(screen.getByLabelText("受信トレイ 3件").textContent).toBe("3");
    expect(screen.getByLabelText("受信トレイ 3件").className).toContain("bg-red-500");
    rerender(<CountBadge count={100} />);
    expect(screen.getByLabelText("100件").textContent).toBe("99+");
  });
});
