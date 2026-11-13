import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { ShopProfile } from "../../map/types/shopData";
import ShopResultCard from "./ShopResultCard";

it("出店しない店舗は地図でなく店舗情報へ誘導する", () => {
  const shop = { id: 1001, name: "八百屋", ownerName: "", category: "野菜", products: ["トマト"], hasMapLocation: false, nextMarketStatus: "not_scheduled" } as ShopProfile;
  render(<ShopResultCard shop={shop} isFavorite={false} />);
  expect(screen.getByText("次の日曜は出店予定なし")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /店舗情報を見る/ })).toHaveAttribute("href", "/shops/1001");
  expect(screen.queryByText("#1001")).toBeNull();
});
