import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Surface } from "./surface";

describe("Surface", () => {
  it("既定は raised（カードの影つき）で padding は md", () => {
    render(<Surface data-testid="s">中身</Surface>);
    const el = screen.getByTestId("s");
    expect(el.className).toContain("shadow-card");
    expect(el.className).toContain("rounded-card");
    expect(el.className).toContain("p-5");
  });

  it("縁は border ではなく ring で描く（面を並べたときにズレないため）", () => {
    render(<Surface data-testid="s" />);
    const classes = screen.getByTestId("s").className.split(/\s+/);
    expect(classes).toContain("ring-1");
    expect(classes).toContain("ring-line");
    expect(classes).not.toContain("border");
  });

  it("elevation ごとに影が変わる", () => {
    const cases = [
      ["flat", "ring-line"],
      ["raised", "shadow-card"],
      ["lifted", "shadow-lift"],
      ["float", "shadow-float"],
    ] as const;
    for (const [elevation, expected] of cases) {
      const { unmount } = render(<Surface data-testid="s" elevation={elevation} />);
      expect(screen.getByTestId("s").className).toContain(expected);
      unmount();
    }
  });

  it("flat には影を付けない", () => {
    render(<Surface data-testid="s" elevation="flat" />);
    expect(screen.getByTestId("s").className).not.toContain("shadow-");
  });

  it("float だけ角丸が panel になる（画面に固定されるものなので）", () => {
    render(<Surface data-testid="s" elevation="float" />);
    const classes = screen.getByTestId("s").className.split(/\s+/);
    expect(classes).toContain("rounded-panel");
    expect(classes).not.toContain("rounded-card");
  });

  it("padding=none は余白のクラスを出さない（画像を端まで出すカード用）", () => {
    render(<Surface data-testid="s" padding="none" />);
    const classes = screen.getByTestId("s").className.split(/\s+/);
    expect(classes.some((c) => /^p-\d/.test(c))).toBe(false);
  });

  it("as で出力するタグを変えられる", () => {
    render(
      <ul>
        <Surface as="li" data-testid="s">
          項目
        </Surface>
      </ul>
    );
    expect(screen.getByTestId("s").tagName).toBe("LI");
  });

  it("既定は div", () => {
    render(<Surface data-testid="s" />);
    expect(screen.getByTestId("s").tagName).toBe("DIV");
  });
});
