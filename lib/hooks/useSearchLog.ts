import { useEffect, useRef } from "react";
import { MIN_SEARCH_KEYWORD_LENGTH, recordSearch } from "@/lib/analytics/searchLogs";

/** 打ち終わってからこの時間で検索ログを送る */
export const SEARCH_LOG_DEBOUNCE_MS = 1000;

/**
 * 検索欄に打った語を、打ち終わって1秒後に記録する（/search と地図の検索バーで共通）。
 *
 * 数えるのは「語が変わったとき」だけ。件数（resultCount）はジャンルの絞り込みなどでも
 * 変わるため、件数の変化で数え直すと、同じ語が二重に記録されてトレンドが水増しされる。
 * 件数は送る時点の最新の値を使う。
 *
 * skipQuery を渡すと、その語が最初に入っている間は数えない（URL の ?q= で渡ってきた語など、
 * その画面で打った検索ではないもの）。一度書き換えたら、同じ語に戻しても数える。
 */
export function useSearchLog(query: string, resultCount: number, skipQuery: string | null = null) {
  const resultCountRef = useRef(resultCount);
  useEffect(() => {
    resultCountRef.current = resultCount;
  }, [resultCount]);

  const skipQueryRef = useRef(skipQuery);
  useEffect(() => {
    if (query === skipQueryRef.current) return;
    skipQueryRef.current = null;
    const keyword = query.trim();
    if (keyword.length < MIN_SEARCH_KEYWORD_LENGTH) return;
    const timer = setTimeout(() => recordSearch(keyword, resultCountRef.current), SEARCH_LOG_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
}
