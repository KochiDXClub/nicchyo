import { unstable_cache } from "next/cache";
import { fetchPublicShopProfiles } from "@/app/(public)/map/services/shopCache";
import { buildSearchTermDictionary } from "./searchTermMatch";

const SEARCH_TERM_DICTIONARY_CACHE_TAG = "search-term-dictionary";

/**
 * 検索語の辞書（公開中の店舗の店舗名・カテゴリー・商品名を正規化したもの）。
 * 店舗の読み込みは /map・/search と同じ fetchPublicShopProfiles（掲載許可のある店舗だけ）を使う。
 * 検索のたびに店舗を組み立てないよう、短い時間キャッシュする。読み取りに失敗したときは例外のままでキャッシュされない。
 */
export const getSearchTermDictionary = unstable_cache(
  async (): Promise<string[]> => buildSearchTermDictionary(await fetchPublicShopProfiles()),
  [SEARCH_TERM_DICTIONARY_CACHE_TAG],
  { tags: [SEARCH_TERM_DICTIONARY_CACHE_TAG], revalidate: 10 * 60 },
);
