import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadFavoriteEntries, saveFavoriteEntries } from "@/lib/favoriteShops";
import FavoritesPageClient from "./FavoritesPageClient";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/hooks/useShops", () => ({ useShops: () => ({ shops: [], isLoading: false }) }));
vi.mock("../../components/NavigationBar", () => ({ default: () => null }));
vi.mock("../map/components/ShopDetailBanner", () => ({ default: () => null }));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
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
