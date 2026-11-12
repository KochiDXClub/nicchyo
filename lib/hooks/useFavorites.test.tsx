import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFavoriteEntries, saveFavoriteEntries } from "../favoriteShops";
import { useFavoriteEntries } from "./useFavorites";

describe("旧番号から移行したお気に入り", () => {
  beforeEach(() => {
    localStorage.clear();
    saveFavoriteEntries([{ shopId: 1001, legacyShopId: 12, product: null, addedAt: 1 }]);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("対応を検証するまで旧番号を表示し、確認後に店舗番号を表示する", async () => {
    let complete!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; })));
    const { result } = renderHook(() => useFavoriteEntries());
    expect(result.current[0].shopId).toBe(12);
    await act(async () => complete({ ok: true, json: async () => ({ enabled: true, aliases: { 12: 1001 } }) } as Response));
    await waitFor(() => expect(result.current[0].shopId).toBe(1001));
  });

  it("対応が取り消された場合は旧番号に戻し、保存したお気に入りを失わない", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ enabled: true, aliases: {} }) })));
    const { result } = renderHook(() => useFavoriteEntries());
    await waitFor(() => expect(loadFavoriteEntries()[0].shopId).toBe(12));
    expect(result.current[0].shopId).toBe(12);
  });

  it("確認に失敗しても以前の対応先を表示しない", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    const { result } = renderHook(() => useFavoriteEntries());
    await act(async () => {});
    expect(result.current[0].shopId).toBe(12);
    expect(loadFavoriteEntries()[0].shopId).toBe(1001);
  });
});
