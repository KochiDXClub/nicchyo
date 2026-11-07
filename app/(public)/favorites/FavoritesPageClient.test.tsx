import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadFavoriteEntries, saveFavoriteEntries } from "@/lib/favoriteShops";
import FavoritesPageClient from "./FavoritesPageClient";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const catalog = vi.hoisted(() => ({ profiles: [] as { id: number; name: string; nextMarketStatus: string; hasMapLocation: boolean; products: string[]; category: string; ownerName: string }[] }));
vi.mock("@/lib/hooks/useShops", () => ({ useShops: () => ({ shops: [], profiles: catalog.profiles, isLoading: false }) }));
vi.mock("../../components/NavigationBar", () => ({ default: () => null }));
vi.mock("../map/components/ShopDetailBanner", () => ({ default: () => null }));

beforeEach(() => {
  localStorage.clear();
  catalog.profiles = [];
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
});

it("出店しない週もお気に入りに店舗と状態を表示し、位置の案内を出さない", async () => {
  catalog.profiles = [{ id: 1001, name: "八百屋", nextMarketStatus: "not_scheduled", hasMapLocation: false, products: [], category: "野菜", ownerName: "" }];
  saveFavoriteEntries([{ shopId: 1001, product: null, addedAt: 1 }]);
  render(<FavoritesPageClient />);
  expect(await screen.findByText("八百屋")).toBeInTheDocument();
  expect(screen.getByText("次の日曜は出店予定なし")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "地図でみる" })).toBeNull();
});
afterEach(() => vi.unstubAllGlobals());

it("旧番号の確認に失敗しても、表示中の商品を削除して元に戻せる", async () => {
  saveFavoriteEntries([{ shopId: 1001, legacyShopId: 12, product: "トマト", addedAt: 1 }]);
  render(<FavoritesPageClient />);
  fireEvent.click(await screen.findByRole("button", { name: "トマトをお気に入りから外す" }));
  expect(loadFavoriteEntries()).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
  await waitFor(() => expect(loadFavoriteEntries()).toEqual([{ shopId: 1001, legacyShopId: 12, product: "トマト", addedAt: 1 }]));
});

it("旧番号の確認に失敗しても、保存された店舗を削除できる", async () => {
  saveFavoriteEntries([{ shopId: 1001, legacyShopId: 12, product: null, addedAt: 1 }]);
  render(<FavoritesPageClient />);
  fireEvent.click(await screen.findByRole("button", { name: "お気に入りから外す" }));
  expect(loadFavoriteEntries()).toEqual([]);
});
