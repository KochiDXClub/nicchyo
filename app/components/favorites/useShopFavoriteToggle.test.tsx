import { act, renderHook } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadFavoriteEntries, toggleFavoriteProduct } from "@/lib/favoriteShops";
import { useShopFavoriteToggle } from "./useShopFavoriteToggle";

const SHOP_ID = 7;
const shopRows = () => loadFavoriteEntries().filter((entry) => entry.shopId === SHOP_ID);
const confirmRemoval = (dialog: ReactElement) => (dialog.props as { onConfirm: () => void }).onConfirm();

beforeEach(() => {
  localStorage.clear();
});

describe("useShopFavoriteToggle", () => {
  // 店舗バナーと検索は onChange を渡していない。それでもハートは保存されないといけない
  it("onChange を渡さなくても、店のハートを入れて外せる", () => {
    const { result } = renderHook(() => useShopFavoriteToggle());

    act(() => result.current.toggleShopFavorite(SHOP_ID));
    expect(shopRows()).toHaveLength(1);

    act(() => result.current.toggleShopFavorite(SHOP_ID));
    expect(shopRows()).toHaveLength(0);
  });

  it("商品がぶら下がっている店は、確認してから商品ごと消す（onChange が無くても）", () => {
    toggleFavoriteProduct(SHOP_ID, "トマト");
    const { result } = renderHook(() => useShopFavoriteToggle());

    act(() => result.current.toggleShopFavorite(SHOP_ID));
    // 確認待ち。まだ消えていない
    expect(shopRows()).toHaveLength(1);

    act(() => confirmRemoval(result.current.confirmDialog));
    expect(shopRows()).toHaveLength(0);
  });

  it("onChange には保存したあとの一覧を渡す", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useShopFavoriteToggle({ onChange }));

    act(() => result.current.toggleShopFavorite(SHOP_ID));

    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ shopId: SHOP_ID })]));
  });
});
