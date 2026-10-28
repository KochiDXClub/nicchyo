import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useMapSearchFilter } from "./useMapSearchFilter";

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
});
