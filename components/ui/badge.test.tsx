import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("中身を出す", () => {
    render(<Badge>新着</Badge>);
    expect(screen.getByText("新着")).toBeInTheDocument();
  });

  it("既定は neutral", () => {
    render(<Badge data-testid="b">分類</Badge>);
    expect(screen.getByTestId("b").className).toContain("text-nicchyo-ink/65");
  });

  it("variant ごとに色が変わる", () => {
    const cases = [
      ["neutral", "text-nicchyo-ink/65"],
      ["amber", "text-amber-800"],
      ["solid", "text-white"],
      ["favorite", "text-favorite-fg"],
      ["ai", "text-ai-fg"],
      ["info", "text-info-fg"],
      ["caution", "text-rose-700"],
    ] as const;
    for (const [variant, expected] of cases) {
      const { unmount } = render(
        <Badge data-testid="b" variant={variant}>
          札
        </Badge>
      );
      expect(screen.getByTestId("b").className).toContain(expected);
      unmount();
    }
  });

  it("丸・11px で統一されている", () => {
    render(<Badge data-testid="b">札</Badge>);
    const classes = screen.getByTestId("b").className.split(/\s+/);
    expect(classes).toContain("rounded-chip");
    expect(classes).toContain("text-[11px]");
  });

  it("押せる要素ではない（押せるものは Button を使う）", () => {
    render(<Badge data-testid="b">札</Badge>);
    expect(screen.getByTestId("b").tagName).toBe("SPAN");
  });
});
