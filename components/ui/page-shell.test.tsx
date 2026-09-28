import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PageShell, PageContainer, PageHeader } from "./page-shell";

describe("PageShell", () => {
  it("地の色・文字色・最低の高さを持つ（ページ側で塗り直さないため）", () => {
    render(<PageShell data-testid="shell" />);
    const classes = screen.getByTestId("shell").className.split(/\s+/);
    expect(classes).toContain("min-h-screen");
    expect(classes).toContain("bg-nicchyo-base");
    expect(classes).toContain("text-nicchyo-ink");
  });

  it("既定では NavigationBar の高さを下の余白に含める", () => {
    render(<PageShell data-testid="shell" />);
    const style = screen.getByTestId("shell").getAttribute("style") ?? "";
    expect(style).toContain("--nav-bar-height");
    expect(style).toContain("--safe-bottom");
  });

  it("bottomNav=false ではナビの高さを含めず、端末の下端だけ避ける", () => {
    render(<PageShell data-testid="shell" bottomNav={false} />);
    const style = screen.getByTestId("shell").getAttribute("style") ?? "";
    expect(style).not.toContain("--nav-bar-height");
    expect(style).toContain("--safe-bottom");
  });

  it("呼び出し側の style を消さない", () => {
    render(<PageShell data-testid="shell" style={{ color: "red" }} />);
    const style = screen.getByTestId("shell").getAttribute("style") ?? "";
    expect(style).toContain("--safe-bottom");
    expect(style).toContain("red");
  });

  it("as で出力するタグを変えられる", () => {
    render(<PageShell as="main" data-testid="shell" />);
    expect(screen.getByTestId("shell").tagName).toBe("MAIN");
  });
});

describe("PageContainer", () => {
  it("幅は画面から測った3段階だけ持つ", () => {
    const cases = [
      ["narrow", "max-w-[32rem]"],
      ["reading", "max-w-[38rem]"],
      ["wide", "max-w-[64rem]"],
    ] as const;
    for (const [width, expected] of cases) {
      const { unmount } = render(<PageContainer data-testid="c" width={width} />);
      expect(screen.getByTestId("c").className).toContain(expected);
      unmount();
    }
  });

  it("既定は reading（読み物の幅）", () => {
    render(<PageContainer data-testid="c" />);
    expect(screen.getByTestId("c").className).toContain("max-w-[38rem]");
  });

  it("中央寄せと左右の余白を持つ", () => {
    render(<PageContainer data-testid="c" />);
    const classes = screen.getByTestId("c").className.split(/\s+/);
    expect(classes).toContain("mx-auto");
    expect(classes).toContain("px-5");
  });
});

describe("PageHeader", () => {
  it("上に貼りつき、クリーム地を透かして敷く", () => {
    render(<PageHeader data-testid="h" label="設定" />);
    const classes = screen.getByTestId("h").className.split(/\s+/);
    expect(classes).toContain("sticky");
    expect(classes).toContain("top-0");
    expect(classes).toContain("backdrop-blur");
  });

  it("クリーム地の上の罫（line-warm）で切る。白い面の上の罫とは色が違う", () => {
    render(<PageHeader data-testid="h" />);
    const classes = screen.getByTestId("h").className.split(/\s+/);
    expect(classes).toContain("border-line-warm");
    expect(classes).not.toContain("border-line");
  });

  it("label と action を出す", () => {
    render(<PageHeader label="プライバシーポリシー" action={<button type="button">閉じる</button>} />);
    expect(screen.getByText("プライバシーポリシー")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
  });

  it("label を渡さなければ何も出さない", () => {
    const { container } = render(<PageHeader />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("幅は PageContainer と同じ段階を使う", () => {
    const { container } = render(<PageHeader width="wide" label="分析" />);
    expect(container.querySelector(".max-w-\\[64rem\\]")).not.toBeNull();
  });
});
