import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReviewToolbar } from "./ReviewToolbar";
import { ReviewStats } from "./ReviewStats";

const filters = [
  { key: "all", label: "すべて", count: 3 },
  { key: "hidden", label: "非表示", count: 1 },
] as const;

describe("ReviewToolbar", () => {
  it("選択中のフィルターを aria-pressed で示し、押すと変更を通知する", () => {
    const onChange = vi.fn();
    render(
      <ReviewToolbar
        filters={filters}
        value="all"
        onChange={onChange}
        search={{ value: "", onChange: () => {}, placeholder: "検索" }}
      />
    );
    expect(screen.getByRole("button", { name: /すべて/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /非表示/ }));
    expect(onChange).toHaveBeenCalledWith("hidden");
  });

  it("検索欄の入力を通知する", () => {
    const onSearch = vi.fn();
    render(
      <ReviewToolbar
        filters={filters}
        value="all"
        onChange={() => {}}
        search={{ value: "", onChange: onSearch, placeholder: "検索" }}
      />
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "検索" }), { target: { value: "魚" } });
    expect(onSearch).toHaveBeenCalledWith("魚");
  });
});

describe("ReviewStats", () => {
  it("渡した件数をラベルつきで並べる", () => {
    render(<ReviewStats items={[{ label: "総数", value: 5 }, { label: "公開中", value: 2, tone: "good" }, { label: "停止中", value: 3 }]} />);
    expect(screen.getByText("総数").nextElementSibling?.textContent).toBe("5");
    expect(screen.getByText("停止中")).toBeTruthy();
  });
});
