import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useMapSearchFilter } from "./useMapSearchFilter";
import type { ShopProfile } from "../types/shopData";

// 検索ログ（打った語の記録）は lib/hooks/useSearchLog.test.ts で確かめる

describe("useMapSearchFilter の初期ジャンル", () => {
  it("URL のジャンルで最初から絞り込む（トップページのジャンルから来たとき）", () => {
    const { result } = renderHook(() =>
      useMapSearchFilter({ shops: [], favoriteShopIds: [], initialCategory: "食材" })
    );
    expect(result.current.category).toBe("食材");
    expect(result.current.hasFilter).toBe(true);
  });

  it("指定がなければ絞り込みなし", () => {
    const { result } = renderHook(() => useMapSearchFilter({ shops: [], favoriteShopIds: [] }));
    expect(result.current.category).toBeNull();
  });

  it("座標のない店舗を検索結果として返し、地図のピンには含めない", () => {
    const profile = { id: 1001, name: "八百屋", ownerName: "", category: "野菜", products: ["トマト"], hasMapLocation: false, nextMarketStatus: "not_scheduled" } as ShopProfile;
    const { result } = renderHook(() => useMapSearchFilter({ shops: [], profiles: [profile], favoriteShopIds: [], initialQuery: "トマト" }));
    expect(result.current.unplacedResults).toEqual([profile]);
    expect(result.current.shopIds).toEqual([]);
  });
});
