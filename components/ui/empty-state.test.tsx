import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Search } from "lucide-react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("見出しを出す", () => {
    render(<EmptyState title="まだ何もありません" />);
    expect(screen.getByRole("heading", { name: "まだ何もありません" })).toBeInTheDocument();
  });

  it("icon が文字列なら絵文字としてそのまま出す（管理画面の呼び出し方）", () => {
    render(<EmptyState icon="📭" title="ログがありません" />);
    expect(screen.getByText("📭")).toBeInTheDocument();
  });

  it("icon がコンポーネントなら lucide のアイコンとして描く", () => {
    const { container } = render(<EmptyState icon={Search} title="見つかりません" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("icon を渡さなければ図の枠ごと出さない", () => {
    const { container } = render(<EmptyState title="見出しだけ" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector(".rounded-chip")).toBeNull();
  });

  it("description は省略できる", () => {
    render(<EmptyState title="見出しだけ" />);
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("action と secondaryAction を並べる", () => {
    render(
      <EmptyState
        title="見つかりません"
        action={<button type="button">やり直す</button>}
        secondaryAction={<button type="button">戻る</button>}
      />
    );
    expect(screen.getByRole("button", { name: "やり直す" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();
  });

  it("操作が無ければ操作の行を出さない", () => {
    const { container } = render(<EmptyState title="見出しだけ" />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("bordered=false のとき破線の枠を出さない（管理画面はこちら）", () => {
    const { container } = render(<EmptyState title="見出し" bordered={false} />);
    expect(container.firstElementChild?.className).not.toContain("border-dashed");
  });

  it("bordered の既定は true", () => {
    const { container } = render(<EmptyState title="見出し" />);
    expect(container.firstElementChild?.className).toContain("border-dashed");
  });

  it("tone で枠の色が変わる", () => {
    const { container, unmount } = render(<EmptyState title="見出し" tone="amber" />);
    expect(container.firstElementChild?.className).toContain("border-amber-200");
    unmount();

    const neutral = render(<EmptyState title="見出し" tone="neutral" />);
    expect(neutral.container.firstElementChild?.className).toContain("border-line");
  });
});
