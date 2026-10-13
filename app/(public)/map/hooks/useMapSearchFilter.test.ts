import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordSearch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/searchLogs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/searchLogs")>()),
  recordSearch,
}));

import { SEARCH_LOG_DEBOUNCE_MS, useMapSearchFilter } from "./useMapSearchFilter";

function setup(initialQuery = "") {
  return renderHook(() => useMapSearchFilter({ shops: [], favoriteShopIds: [], initialQuery }));
}

function type(result: ReturnType<typeof setup>["result"], value: string) {
  act(() => {
    result.current.setQuery(value);
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useMapSearchFilter の検索ログ", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    recordSearch.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("打ち終わって1秒たったら、最後の語を1回だけ記録する", () => {
    const { result } = setup();
    type(result, "トマ");
    advance(500);
    type(result, "トマト");
    advance(SEARCH_LOG_DEBOUNCE_MS - 1);
    expect(recordSearch).not.toHaveBeenCalled();
    advance(1);
    expect(recordSearch).toHaveBeenCalledTimes(1);
    expect(recordSearch).toHaveBeenCalledWith("トマト", 0);
  });

  it("前後の空白は落とし、2文字未満は記録しない", () => {
    const { result } = setup();
    type(result, " あ ");
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).not.toHaveBeenCalled();
    type(result, " いも ");
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).toHaveBeenCalledWith("いも", 0);
  });

  it("URL の ?q= で渡ってきた語は記録しないが、書き換えたら記録する", () => {
    const { result } = setup("トマト");
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).not.toHaveBeenCalled();

    type(result, "トマトジュース");
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).toHaveBeenCalledWith("トマトジュース", 0);

    // 一度書き換えたあとは、最初と同じ語に戻しても数える
    type(result, "トマト");
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).toHaveBeenLastCalledWith("トマト", 0);
  });

  it("消したら送りかけの記録も取りやめる", () => {
    const { result } = setup();
    type(result, "トマト");
    advance(500);
    act(() => {
      result.current.clearFilters();
    });
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).not.toHaveBeenCalled();
  });
});
