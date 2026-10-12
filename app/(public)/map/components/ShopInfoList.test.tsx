import { fireEvent, render, screen } from "@testing-library/react";
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
    schedule: "",
    ...overrides,
  }) as Shop;

const FULL: Partial<Shop> = {
  businessHoursStart: "6:00",
  businessHoursEnd: "14:00",
  rainPolicy: "tent",
  schedule: "毎週日曜",
  paymentMethods: ["cash", "paypay"],
  stallStyleTags: ["対面販売"],
  ownerName: "高知高校 園芸部",
  socialLinks: { instagram: "@koko_engei", website: "https://example.com" },
};

const visible = (text: string) => {
  const el = screen.queryByText(text);
  return !!el && !el.closest("[hidden]");
};
const openMore = () => fireEvent.click(screen.getByRole("button", { name: "もっと見る" }));

describe("ShopInfoList", () => {
  it("最初は出店時間と雨の日だけを出し、ほかは「もっと見る」で開く", () => {
    render(<ShopInfoList shop={shop(FULL)} />);

    expect(visible("6:00 〜 14:00")).toBe(true);
    expect(visible("雨でも出店（テント）")).toBe(true);
    expect(visible("毎週日曜")).toBe(false);
    expect(visible("PayPay")).toBe(false);
    expect(screen.getByRole("button", { name: "もっと見る" }).getAttribute("aria-expanded")).toBe("false");

    openMore();

    expect(visible("毎週日曜")).toBe(true);
    expect(visible("PayPay")).toBe(true);
    expect(screen.getByRole("button", { name: "閉じる" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("Instagram とサイトは「もっと見る」に入れず、いつも見せる", () => {
    render(<ShopInfoList shop={shop(FULL)} />);

    expect(visible("Instagram")).toBe(true);
    expect(visible("サイト")).toBe(true);
  });

  it("出店時間や雨の日が無い店でも、ほかの情報を2つまで最初から見せる", () => {
    render(<ShopInfoList shop={shop({ ...FULL, businessHoursStart: undefined, businessHoursEnd: undefined, rainPolicy: "undecided" })} />);

    expect(visible("毎週日曜")).toBe(true);
    expect(visible("PayPay")).toBe(true);
    expect(visible("対面販売")).toBe(false);

    openMore();

    expect(visible("対面販売")).toBe(true);
  });

  it("書かれている項目が2つまでなら、「もっと見る」を出さない", () => {
    render(<ShopInfoList shop={shop({ businessHoursStart: "6:00", businessHoursEnd: "14:00", schedule: "毎週日曜", socialLinks: { instagram: "@a" } })} />);

    expect(visible("6:00 〜 14:00")).toBe(true);
    expect(visible("毎週日曜")).toBe(true);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("場所（丁目）は出さない", () => {
    render(<ShopInfoList shop={shop(FULL)} />);
    openMore();

    expect(screen.queryByText("場所")).toBeNull();
    expect(screen.queryByText("六丁目")).toBeNull();
  });

  // 出店者名は個人情報。公開にした出店者の名前だけが届き、空なら欄ごと出さない
  it("出店者名が空なら、出店者の欄を出さない", () => {
    render(<ShopInfoList shop={shop({ ...FULL, ownerName: "  " })} />);
    openMore();

    expect(screen.queryByText("出店者")).toBeNull();
  });

  it("出店者名が公開されていれば出す（高校の部活などの団体名）", () => {
    render(<ShopInfoList shop={shop(FULL)} />);
    openMore();

    expect(visible("出店者")).toBe(true);
    expect(visible("高知高校 園芸部")).toBe(true);
  });

  it("書かれている項目が何も無ければ、何も出さない", () => {
    const { container } = render(<ShopInfoList shop={shop({})} />);

    expect(container.innerHTML).toBe("");
  });
});
