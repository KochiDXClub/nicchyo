import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Shop } from "../data/shops";
import { ShopInfoList } from "./ShopBannerHero";

const shop = (overrides: Partial<Shop>): Shop =>
  ({
    id: 1,
    position: 1,
    lat: 0,
    lng: 0,
    name: "テスト店",
    ownerName: "",
    category: "食材",
    chome: "六丁目",
    products: [],
    description: "",
    schedule: "毎週日曜",
    ...overrides,
  }) as Shop;

describe("ShopInfoList", () => {
  it("場所（丁目）は出さない", () => {
    render(<ShopInfoList shop={shop({})} />);

    expect(screen.queryByText("場所")).toBeNull();
    expect(screen.queryByText("六丁目")).toBeNull();
  });

  // 出店者名は個人情報。公開にした出店者の名前だけが届き、空なら欄ごと出さない
  it("出店者名が空なら、出店者の欄を出さない", () => {
    render(<ShopInfoList shop={shop({ ownerName: "  " })} />);

    expect(screen.queryByText("出店者")).toBeNull();
  });

  it("出店者名が公開されていれば出す（高校の部活などの団体名）", () => {
    render(<ShopInfoList shop={shop({ ownerName: "高知高校 園芸部" })} />);

    expect(screen.getByText("出店者")).toBeTruthy();
    expect(screen.getByText("高知高校 園芸部")).toBeTruthy();
  });

  it("書かれている項目が何も無ければ、何も出さない", () => {
    const { container } = render(<ShopInfoList shop={shop({ schedule: "" })} />);

    expect(container.innerHTML).toBe("");
  });
});
