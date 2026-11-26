import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GenreFilter } from "./GenreFilter";

const baseProps = {
  selected: null,
  favoritesActive: false,
  favoriteCount: 0,
  onToggleFavorites: () => {},
};

describe("GenreFilter", () => {
  test("labelFor を渡さなければ、チップは値（日本語の名前）をそのまま出す", () => {
    render(<GenreFilter {...baseProps} categories={["野菜・果物", "食べ物"]} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "野菜・果物" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "食べ物" })).toBeTruthy();
  });

  test("labelFor の表示名を出すが、選んだときに渡る値は日本語の名前のまま", () => {
    const onSelect = vi.fn();
    const labels: Record<string, string> = { "野菜・果物": "Vegetables and fruit", "食べ物": "Food and snacks" };
    render(
      <GenreFilter
        {...baseProps}
        categories={["野菜・果物", "食べ物"]}
        labelFor={(cat) => labels[cat] ?? cat}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Vegetables and fruit" }));
    expect(onSelect).toHaveBeenCalledWith("野菜・果物");
  });
});
