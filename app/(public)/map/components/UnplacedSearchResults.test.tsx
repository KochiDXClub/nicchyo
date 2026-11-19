import { render, renderHook, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { ShopProfile } from "../types/shopData";
import { UnplacedSearchResults } from "./UnplacedSearchResults";
import { buildSearchIndex } from "../../search/lib/searchIndex";
import { useShopSearch } from "../../search/hooks/useShopSearch";

it("地図にない店舗も状態と店舗ページへのリンクを表示する", () => {
  const shop = { id: 1001, name: "八百屋", hasMapLocation: false, nextMarketStatus: "unknown" } as ShopProfile;
  render(<UnplacedSearchResults shops={[shop]} />);
  expect(screen.getByRole("link", { name: /八百屋/ })).toHaveAttribute("href", "/shops/1001");
  expect(screen.getByText("次の日曜の出店予定を確認中")).toBeInTheDocument();
});

it("座標がなくても店名・商品名で検索できる", () => {
  const shop = { id: 1001, name: "八百屋", ownerName: "", category: "野菜", products: ["トマト"], hasMapLocation: false, nextMarketStatus: "not_scheduled" } as ShopProfile;
  const shops = [shop];
  const { result } = renderHook(() => useShopSearch({ shops, searchIndex: buildSearchIndex(shops), textQuery: "トマト", category: null, chome: null }));
  expect(result.current).toEqual([shop]);
});
