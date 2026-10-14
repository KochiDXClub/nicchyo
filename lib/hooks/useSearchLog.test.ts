import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordSearch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/searchLogs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics/searchLogs")>()),
  recordSearch,
}));

import { SEARCH_LOG_DEBOUNCE_MS, useSearchLog } from "./useSearchLog";

type Props = { query: string; resultCount: number };

function setup(skipQuery: string | null = null, initial: Props = { query: skipQuery ?? "", resultCount: 0 }) {
  return renderHook((props: Props) => useSearchLog(props.query, props.resultCount, skipQuery), {
    initialProps: initial,
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useSearchLog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    recordSearch.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("打ち終わって1秒たったら、最後の語を1回だけ記録する", () => {
    const { rerender } = setup();
    rerender({ query: "トマ", resultCount: 5 });
    advance(500);
    rerender({ query: "トマト", resultCount: 3 });
    advance(SEARCH_LOG_DEBOUNCE_MS - 1);
    expect(recordSearch).not.toHaveBeenCalled();
    advance(1);
    expect(recordSearch).toHaveBeenCalledTimes(1);
    expect(recordSearch).toHaveBeenCalledWith("トマト", 3);
  });

  it("前後の空白は落とし、2文字未満は記録しない", () => {
    const { rerender } = setup();
    rerender({ query: " あ ", resultCount: 1 });
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).not.toHaveBeenCalled();
    rerender({ query: " いも ", resultCount: 2 });
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).toHaveBeenCalledWith("いも", 2);
  });

  // ジャンルの絞り込みなどで件数だけが変わっても、同じ語を二重に数えない
  it("件数だけが変わっても数え直さない（送るのは最新の件数）", () => {
    const { rerender } = setup();
    rerender({ query: "トマト", resultCount: 3 });
    advance(500);
    rerender({ query: "トマト", resultCount: 1 });
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).toHaveBeenCalledTimes(1);
    expect(recordSearch).toHaveBeenCalledWith("トマト", 1);

    rerender({ query: "トマト", resultCount: 7 });
    advance(SEARCH_LOG_DEBOUNCE_MS * 2);
    expect(recordSearch).toHaveBeenCalledTimes(1);
  });

  it("skipQuery の語は記録しないが、書き換えたら記録する", () => {
    const { rerender } = setup("トマト");
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).not.toHaveBeenCalled();

    rerender({ query: "トマトジュース", resultCount: 0 });
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).toHaveBeenCalledWith("トマトジュース", 0);

    // 一度書き換えたあとは、最初と同じ語に戻しても数える
    rerender({ query: "トマト", resultCount: 0 });
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).toHaveBeenLastCalledWith("トマト", 0);
  });

  it("消したら送りかけの記録も取りやめる", () => {
    const { rerender } = setup();
    rerender({ query: "トマト", resultCount: 0 });
    advance(500);
    rerender({ query: "", resultCount: 0 });
    advance(SEARCH_LOG_DEBOUNCE_MS);
    expect(recordSearch).not.toHaveBeenCalled();
  });
});
